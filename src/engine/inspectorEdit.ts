import { dump, load } from 'js-yaml';
import { validateDoc, type ValidationIssue } from '../schemas/validator';
import type { EmployeeConfig, MachineId, MemoryTier, NetworkMode, PolicyContext, PolicyDecision, SNode } from '../types';
import { autonomyLevel, canTransition, promotionReady } from '../types';
import { reconcileNode } from './employeeFactory';
import { isPermitted, memoryPermitted } from './permissionStore';
import { touchesPep } from './generators';
import { PolicyEngine } from './policyEngine';
import { syntheticBenchmark } from './qualityGates';
import { scanForSecrets, validateSecretRef } from './secretGuard';
import type { SsrfConfig } from './ssrfGuard';

/**
 * Every change the inspector can make, as a pure function of (node, tenant). A refused change returns a code and a message and the node is untouched.
 * A change that is accepted but breaks a schema is still committed (so the text the person typed is not lost) and returns the issues, which the
 * Problems panel also lists. Derived fields (network mode, autonomy, manifest) are re-derived by `reconcileNode` after every commit.
 */
export type Edit =
  | { ok: true; node: SNode; issues: ValidationIssue[] }
  | { ok: false; code: string; message: string; line?: number };

export const fail = (code: string, message: string, line?: number): Edit => ({ ok: false, code, message, ...(line ? { line } : {}) });
const emp = (node: SNode): EmployeeConfig | undefined => node.data.employee;
const NOT_EMP: Edit = fail('NOT_EMPLOYEE', 'This node has no employee files.');

function commit(node: SNode, next: EmployeeConfig, tenant_id: string, issues: ValidationIssue[] = []): Edit {
  return { ok: true, node: reconcileNode({ ...node, data: { ...node.data, employee: next } }, tenant_id), issues };
}
const contractOf = (c: EmployeeConfig) => c.contract as Record<string, unknown>;

// ---- identity -------------------------------------------------------------------------------------------------------------------------------

export function setIdentity(node: SNode, tenant_id: string, patch: { name?: string; mission?: string }): Edit {
  const c = emp(node); if (!c) return NOT_EMP;
  if (patch.name !== undefined && patch.name.trim() === '') return fail('NAME_REQUIRED', 'The name cannot be empty.');
  const contract = { ...c.contract, ...(patch.name !== undefined ? { name: patch.name } : {}), ...(patch.mission !== undefined ? { mission: patch.mission } : {}) };
  return commit(node, { ...c, contract }, tenant_id, validateDoc('contract', contract));
}

/** Writes the network mode into the contract (the source of truth). POL_DRF_HARD_01 for roles that must stay at none is reported by the Problems panel. */
export function setNetworkMode(node: SNode, tenant_id: string, mode: NetworkMode): Edit {
  const c = emp(node); if (!c) return NOT_EMP;
  if (!(['none', 'internal', 'isolated'] as const).includes(mode)) return fail('NETWORK_MODE', `Unknown network mode ${String(mode)}.`);
  const contract = { ...c.contract, runtime_config: { ...(contractOf(c).runtime_config as object | undefined), docker_network: mode } };
  return commit(node, { ...c, contract }, tenant_id, validateDoc('contract', contract));
}

// ---- state machines (LIF-001) and the promotion card (EVA-001) ------------------------------------------------------------------------------

export function transition(node: SNode, tenant_id: string, machine: MachineId, to: string): Edit {
  const c = emp(node); if (!c) return NOT_EMP;
  const from = c[machine];
  if (!canTransition(machine, from, to)) return fail('LIF-001', `${machine} cannot move from ${from} to ${to}.`);
  if (machine === 'lifecycle' && to === 'CERTIFIED' && !promotionReady(c.promotion)) return fail('EVA-001', 'Certification needs 20 of 20 synthetic tasks and a shadow match of at least 95%.');
  if (machine === 'autonomy') {
    const contract = { ...c.contract, authority: { ...(contractOf(c).authority as object | undefined), autonomy_level: autonomyLevel(to as EmployeeConfig['autonomy']) } };
    return commit(node, { ...c, contract }, tenant_id, validateDoc('contract', contract));
  }
  return commit(node, { ...c, [machine]: to } as EmployeeConfig, tenant_id);
}

/** Phase 1 of §6.2.2: runs the 20 synthetic task_result messages against task_result.schema.json. */
export function runSyntheticBenchmark(node: SNode, tenant_id: string): Edit {
  const c = emp(node); if (!c) return NOT_EMP;
  return commit(node, { ...c, promotion: { ...c.promotion, synthetic_passed: syntheticBenchmark(c) } }, tenant_id);
}
export function setShadowMatch(node: SNode, tenant_id: string, value: number): Edit {
  const c = emp(node); if (!c) return NOT_EMP;
  if (!Number.isFinite(value) || value < 0 || value > 1) return fail('PROMO_RANGE', 'Shadow match is a number from 0 to 1.');
  return commit(node, { ...c, promotion: { ...c.promotion, shadow_match_rate: value } }, tenant_id);
}
export function setScorecard(node: SNode, tenant_id: string, key: string, value: number): Edit {
  const c = emp(node); if (!c) return NOT_EMP;
  if (!(key in c.promotion.scorecard)) return fail('PROMO_KEY', `${key} is not a metric of this role.`);
  if (!Number.isFinite(value) || value < 0 || value > 1) return fail('PROMO_RANGE', 'A scorecard metric is a number from 0 to 1.');
  return commit(node, { ...c, promotion: { ...c.promotion, scorecard: { ...c.promotion.scorecard, [key]: value } } }, tenant_id);
}

// ---- raw documents ---------------------------------------------------------------------------------------------------------------------------

const lineFromPosition = (text: string, pos: number) => text.slice(0, pos).split('\n').length;
/** Parses contract.json / manifest.yaml text. A syntax error keeps the stored document and reports the line. */
export function editDocument(node: SNode, tenant_id: string, which: 'contract' | 'manifest', text: string): Edit {
  const c = emp(node); if (!c) return NOT_EMP;
  let doc: unknown;
  try { doc = which === 'contract' ? JSON.parse(text) : load(text); }
  catch (e) {
    const err = e as { message?: string; reason?: string; mark?: { line?: number } };
    if (which === 'manifest') return fail('SYNTAX', err.reason ?? String(err.message ?? 'Invalid YAML').split('\n')[0], typeof err.mark?.line === 'number' ? err.mark.line + 1 : undefined);
    const msg = String(err.message ?? 'Invalid JSON');
    const pos = /position (\d+)/.exec(msg), ln = /line (\d+)/.exec(msg);
    return fail('SYNTAX', msg, ln ? Number(ln[1]) : pos ? lineFromPosition(text, Number(pos[1])) : undefined);
  }
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) return fail('DOC_NOT_OBJECT', `${which} must be an object (key: value pairs) at the top level.`);
  return commit(node, { ...c, [which]: doc as Record<string, unknown> }, tenant_id, validateDoc(which, doc));
}

/** 0-based line of a dotted field path (`tools.0.tool_id`) in pretty JSON or block YAML; the deepest part that exists, or -1. */
export function locateField(text: string, field: string, lang: 'json' | 'yaml'): number {
  const lines = text.split('\n');
  if (!field) return lines.length ? 0 : -1;
  const indentOf = (l: string) => l.length - l.trimStart().length;
  const keyOf = (l: string): { key: string; indent: number } | null => {
    const t = l.trim();
    if (lang === 'json') { const m = /^"((?:[^"\\]|\\.)*)"\s*:/.exec(t); return m ? { key: m[1], indent: indentOf(l) } : null; }
    const m = /^(-\s+)?([^\s:#][^:]*?):(\s|$)/.exec(t);
    return m ? { key: m[2].replace(/^["']|["']$/g, ''), indent: indentOf(l) + (m[1] ? m[1].length : 0) } : null;
  };
  const isItem = (l: string) => (lang === 'yaml' ? l.trim().startsWith('- ') || l.trim() === '-' : /^\s*[{["\d\-tfn]/.test(l) && keyOf(l) === null);
  let found = -1, start = 0, parentIndent = -1;
  const lineEnd = (from: number, pIndent: number) => { let i = from + 1; while (i < lines.length && (lines[i].trim() === '' || indentOf(lines[i]) > pIndent || (lang === 'yaml' && indentOf(lines[i]) === pIndent && lines[i].trim().startsWith('- ')))) i++; return i; };
  for (const seg of field.split('.')) {
    const end = parentIndent < 0 ? lines.length : lineEnd(found, parentIndent);
    let hit = -1;
    if (/^\d+$/.test(seg)) {
      const want = Number(seg); let n = -1, childIndent = -1;
      for (let i = start; i < end; i++) {
        if (lines[i].trim() === '') continue;
        if (childIndent < 0 && i > found) childIndent = indentOf(lines[i]);
        if (indentOf(lines[i]) === childIndent && isItem(lines[i])) { n++; if (n === want) { hit = i; break; } }
      }
    } else {
      let childIndent = -1;
      for (let i = start; i < end; i++) {
        if (lines[i].trim() === '') continue;
        const k = keyOf(lines[i]);
        if (!k) continue;
        if (childIndent < 0) childIndent = k.indent;
        if (k.indent === childIndent && k.key === seg) { hit = i; break; }
      }
    }
    if (hit < 0) break;
    found = hit; start = hit + 1; parentIndent = lang === 'yaml' ? (keyOf(lines[hit])?.indent ?? indentOf(lines[hit])) - (lines[hit].trim().startsWith('- ') ? 2 : 0) : indentOf(lines[hit]);
    if (/^\d+$/.test(seg)) parentIndent = indentOf(lines[hit]);
  }
  return found;
}

/** Re-serialises a document the same way the DocEditor shows it. */
export const documentText = (which: 'contract' | 'manifest', doc: unknown): string =>
  which === 'contract' ? `${JSON.stringify(doc, null, 2)}\n` : dump(doc, { lineWidth: 100, noRefs: true });

// ---- custom code (SCA-002) ------------------------------------------------------------------------------------------------------------------

/** Only the custom section of employee.py is editable. Text that names the embedded guard, or that looks like a real secret, is refused. */
export function editCustomCode(node: SNode, tenant_id: string, text: string): Edit {
  const c = emp(node); if (!c) return NOT_EMP;
  if (touchesPep(text)) return fail('SCA-002', 'The embedded policy guard is locked. Remove any mention of it from your code.');
  const hit = scanForSecrets(text)[0];
  if (hit) return fail('SEC-001', `Line ${hit.line} looks like a real secret (${hit.shape}). Use a vault:// reference instead.`, hit.line);
  return commit(node, { ...c, custom_code: text }, tenant_id);
}

// ---- secrets (SEC-001) ------------------------------------------------------------------------------------------------------------------------

const SECRET_NAME_RE = /^[A-Za-z][A-Za-z0-9_]{1,40}$/;
export function addSecret(node: SNode, tenant_id: string, name: string, ref: string): Edit {
  const c = emp(node); if (!c) return NOT_EMP;
  const n = name.trim();
  if (!SECRET_NAME_RE.test(n)) return fail('SECRET_NAME', 'Use a name of letters, digits and underscores, starting with a letter (for example YC_API_KEY).');
  if (c.secrets.some((s) => s.name === n)) return fail('SECRET_DUPLICATE', `A secret named ${n} already exists.`);
  const v = validateSecretRef(ref);
  if (!v.ok) return fail(v.code, v.reason);
  return commit(node, { ...c, secrets: [...c.secrets, { name: n, ref: ref.trim() }] }, tenant_id);
}
/** A value that does not start with vault:// is refused and never stored. */
export function setSecretRef(node: SNode, tenant_id: string, index: number, ref: string): Edit {
  const c = emp(node); if (!c) return NOT_EMP;
  if (!c.secrets[index]) return fail('SECRET_INDEX', 'That secret no longer exists.');
  const v = validateSecretRef(ref);
  if (!v.ok) return fail(v.code, v.reason);
  return commit(node, { ...c, secrets: c.secrets.map((s, i) => (i === index ? { ...s, ref: ref.trim() } : s)) }, tenant_id);
}
export function removeSecret(node: SNode, tenant_id: string, index: number): Edit {
  const c = emp(node); if (!c) return NOT_EMP;
  const gone = c.secrets[index]; if (!gone) return fail('SECRET_INDEX', 'That secret no longer exists.');
  // reconcileNode keeps manifest environment entries it did not derive, so the removed secret's entry is dropped here.
  const m = c.manifest as { spec?: { environment?: Record<string, unknown> } };
  const { [`${gone.name}_SECRET_REF`]: _dropped, ...environment } = m.spec?.environment ?? {};
  const manifest = { ...c.manifest, spec: { ...(m.spec ?? {}), environment } };
  return commit(node, { ...c, manifest, secrets: c.secrets.filter((_, i) => i !== index) }, tenant_id);
}

// ---- runtime limits, skills -----------------------------------------------------------------------------------------------------------------

export function setRuntimeLimits(node: SNode, tenant_id: string, patch: { max_concurrent_tasks?: number; task_timeout_seconds?: number }): Edit {
  const c = emp(node); if (!c) return NOT_EMP;
  for (const [k, v] of Object.entries(patch)) if (!Number.isInteger(v) || (v as number) < 1) return fail('RUNTIME_RANGE', `${k} must be a whole number of at least 1.`);
  const contract = { ...c.contract, runtime_config: { ...(c.contract.runtime_config as object | undefined), ...patch } };
  return commit(node, { ...c, contract }, tenant_id, validateDoc('contract', contract));
}

export const SKILL_NAME_RE = /^[a-z0-9][a-z0-9_-]{0,60}\.md$/;
const withSkills = (c: EmployeeConfig, skills: EmployeeConfig['skills']): EmployeeConfig => ({ ...c, skills, contract: { ...c.contract, skills: skills.map((s) => `skills/${s.name}`) } });
export function addSkill(node: SNode, tenant_id: string, name: string): Edit {
  const c = emp(node); if (!c) return NOT_EMP;
  const n = name.trim();
  if (!SKILL_NAME_RE.test(n)) return fail('SKILL_NAME', 'Use a lower-case file name ending in .md, for example tender_rules.md.');
  if (c.skills.some((s) => s.name === n)) return fail('SKILL_DUPLICATE', `${n} already exists.`);
  const title = n.replace(/\.md$/, '');
  return commit(node, withSkills(c, [...c.skills, { name: n, body: `---\nname: ${title}\nscope: \n---\n# ${title}\n\n## Rules\n1. \n` }]), tenant_id);
}
export function removeSkill(node: SNode, tenant_id: string, index: number): Edit {
  const c = emp(node); if (!c) return NOT_EMP;
  if (!c.skills[index]) return fail('SKILL_INDEX', 'That skill file no longer exists.');
  if (c.skills.length === 1) return fail('SKILL_LAST', 'An employee needs at least one skill file.');
  return commit(node, withSkills(c, c.skills.filter((_, i) => i !== index)), tenant_id);
}
export function setSkillBody(node: SNode, tenant_id: string, index: number, body: string): Edit {
  const c = emp(node); if (!c) return NOT_EMP;
  if (!c.skills[index]) return fail('SKILL_INDEX', 'That skill file no longer exists.');
  const hit = scanForSecrets(body)[0];
  if (hit) return fail('SEC-001', `Line ${hit.line} looks like a real secret (${hit.shape}). Use a vault:// reference instead.`, hit.line);
  return commit(node, { ...c, skills: c.skills.map((s, i) => (i === index ? { ...s, body } : s)) }, tenant_id);
}

// ---- RBAC / ABAC lab --------------------------------------------------------------------------------------------------------------------------

export interface LabQuery {
  role: string; action: string; networkMode: NetworkMode; tenant_id: string;
  resource_tenant?: string; confidentiality?: number; clearance?: number; fit_score?: number; url?: string; method?: string;
  memory_tier?: MemoryTier; memory_access?: 'read' | 'write';
  kill_active?: boolean; founder_token?: boolean; founder_approved?: boolean; budget_breach?: boolean;
}
export interface LabResult { decision: PolicyDecision; rbac: boolean; memory: boolean | null }

/** Asks the real engines (PolicyEngine, isPermitted, memoryPermitted) the question. The lab decides nothing itself. */
export function policyLab(q: LabQuery, ssrf: SsrfConfig): LabResult {
  const ctx: PolicyContext = {
    url: q.url, method: q.method ?? 'GET', fit_score: q.fit_score, budget_breach: q.budget_breach, founder_signed_token: q.founder_token ? { present: true } : undefined,
    founder_approved: q.founder_approved, tenant_id: q.resource_tenant, confidentiality: q.confidentiality, clearance: q.clearance, kill_active: q.kill_active,
  };
  const decision = new PolicyEngine(ssrf).evaluate({ employee_id: `lab.${q.role}.v1`, role: q.role, tenant_id: q.tenant_id, department: 'lab', networkMode: q.networkMode }, q.action, ctx);
  return { decision, rbac: isPermitted(q.role, q.action), memory: q.memory_tier ? memoryPermitted(q.role, q.memory_tier, q.memory_access ?? 'read') : null };
}
