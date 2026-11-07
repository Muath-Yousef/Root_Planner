import { getRole, type InspectorTab } from '../registry';
import type { EmployeeConfig, SEdge, SNode } from '../types';
import { promotionReady } from '../types';
import { validateDoc } from '../schemas/validator';
import { checkCable, effectiveNetwork } from './cablingValidator';
import { scanForSecrets, validateSecretRef } from './secretGuard';
import { networkOf, touchesPep } from './generators';

export type Severity = 'error' | 'warning';
export interface Problem {
  id: string; severity: Severity; source: 'schema' | 'cable' | 'policy' | 'secret' | 'org' | 'topology';
  code: string; message: string; nodeId?: string; edgeId?: string; field?: string; tab?: InspectorTab;
}
export const isEmployeeNode = (n: SNode): n is SNode & { data: { employee: EmployeeConfig } } => !!n.data.employee;

export interface CollectProblemsOptions {
  /** Phase 6 — how ORG-003 is reported for a planned department:
   *  - `'brief'` (default): ONE warning per planned department, naming the
   *    department and how many employees it holds. The warning keeps its
   *    original meaning (no folder will be created for the department on
   *    export); the per-node detail is available with `'per-node'`.
   *  - `'per-node'`: the pre-Phase-6 behaviour — one warning per employee
   *    in a planned department (CLI `validate --verbose`). */
  org003?: 'brief' | 'per-node';
}

/** One list for the Problems panel, the status-bar counter and the export gate. Pure. */
export function collectProblems(nodes: SNode[], edges: SEdge[], ctx: { tenant_id: string }, opts: CollectProblemsOptions = {}): Problem[] {
  const out: Problem[] = [];
  const add = (p: Omit<Problem, 'id'>) => out.push({ ...p, id: `${p.code}:${p.nodeId ?? p.edgeId ?? ''}:${p.field ?? ''}:${out.length}` });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Map<string, string>();
  // Phase 6 — brief ORG-003 needs the department headcount before the loop
  // (the first employee in a department is where its one warning is emitted,
  // so the list order stays where the first per-node warning used to be).
  const org003 = opts.org003 ?? 'brief';
  const deptEmployees = new Map<string, { label: string; status: string; count: number }>();
  for (const n of nodes) {
    if (!isEmployeeNode(n) || n.parentId === undefined) continue;
    const parent = byId.get(n.parentId);
    if (parent?.data.kind !== 'zone' || parent.data.status === 'IMPLEMENTED') continue;
    const entry = deptEmployees.get(parent.id) ?? { label: parent.data.label, status: parent.data.status, count: 0 };
    entry.count++;
    deptEmployees.set(parent.id, entry);
  }
  const org003Briefed = new Set<string>();

  for (const n of nodes) {
    if (!isEmployeeNode(n)) continue;
    const c = n.data.employee, role = n.data.role, nodeId = n.id;
    const who = (c.contract as { employee_id?: string }).employee_id ?? n.data.label;
    for (const [schema, doc, tab] of [['contract', c.contract, 'contract'], ['manifest', c.manifest, 'manifest']] as const)
      for (const i of validateDoc(schema, doc)) add({ severity: 'error', source: 'schema', code: i.code, message: `${who} ${schema}: ${i.message}`, nodeId, field: i.field, tab });
    c.secrets.forEach((s, idx) => { const v = validateSecretRef(s.ref); if (!v.ok) add({ severity: 'error', source: 'secret', code: v.code, message: `${who}: secret ${s.name || `#${idx + 1}`} — ${v.reason}`, nodeId, field: `secrets.${idx}.ref`, tab: 'tools' }); });
    for (const hit of scanForSecrets([c.custom_code, ...c.skills.map((s) => s.body)].join('\n')))
      add({ severity: 'error', source: 'secret', code: 'SEC-001', message: `${who}: text on line ${hit.line} looks like a real secret (${hit.shape}). Use a vault:// reference.`, nodeId, field: 'custom_code', tab: 'code' });
    if (touchesPep(c.custom_code)) add({ severity: 'error', source: 'policy', code: 'SCA-002', message: `${who}: the embedded policy guard is locked and cannot be edited.`, nodeId, field: 'custom_code', tab: 'code' });
    if (getRole(role)?.hard_no_egress && networkOf(c) !== 'none') add({ severity: 'error', source: 'policy', code: 'POL_DRF_HARD_01', message: `${who}: role ${role} must have network mode none.`, nodeId, field: 'runtime_config.docker_network', tab: 'contract' });
    const env = ((c.manifest as { spec?: { environment?: Record<string, string> } }).spec?.environment) ?? {};
    if (env.TENANT_ID && env.TENANT_ID !== ctx.tenant_id) add({ severity: 'error', source: 'policy', code: 'POL_ABAC_TENANT', message: `${who} belongs to tenant ${env.TENANT_ID}, but the active tenant is ${ctx.tenant_id}.`, nodeId, field: 'spec.environment.TENANT_ID', tab: 'manifest' });
    if (c.lifecycle === 'CERTIFIED' && !(promotionReady(c.promotion))) add({ severity: 'error', source: 'org', code: 'EVA-001', message: `${who} is CERTIFIED without promotion evidence (20 synthetic tasks and 95% shadow match).`, nodeId, tab: 'identity' });
    const prev = seen.get(who);
    if (prev) add({ severity: 'error', source: 'org', code: 'ORG_DUPLICATE_ID', message: `Employee id ${who} is used by more than one node.`, nodeId, field: 'employee_id', tab: 'identity' });
    else seen.set(who, nodeId);
    const parent = n.parentId ? byId.get(n.parentId) : undefined;
    if (parent?.data.kind === 'zone' && parent.data.status !== 'IMPLEMENTED') {
      if (org003 === 'per-node') {
        add({ severity: 'warning', source: 'org', code: 'ORG-003', message: `${who} is in a department whose status is ${parent.data.status}. No folder will be created for it.`, nodeId, tab: 'identity' });
      } else if (!org003Briefed.has(parent.id)) {
        // Brief (default, Phase 6): one warning per planned department,
        // naming the department and its headcount — same meaning as the
        // per-node form, without one line per employee. The warning points
        // at the department (zone) node, not at one of its employees.
        org003Briefed.add(parent.id);
        const dept = deptEmployees.get(parent.id)!;
        add({ severity: 'warning', source: 'org', code: 'ORG-003', message: `Department ${dept.label} (${dept.status}): ${dept.count} employee${dept.count === 1 ? '' : 's'} — no folder will be created for it.`, nodeId: parent.id, tab: 'identity' });
      }
    }
    if (n.data.kind === 'employee' && !edges.some((e) => e.target === n.id && e.data?.kind === 'TASK_DISPATCH_RESULT')) add({ severity: 'warning', source: 'topology', code: 'TOPO_UNWIRED', message: `${who} receives no tasks. Connect its manager to it.`, nodeId });
    if (n.data.kind === 'employee' && effectiveNetwork(n) === undefined) add({ severity: 'warning', source: 'topology', code: 'TOPO_NO_NETWORK_MODE', message: `${who} has no network mode.`, nodeId });
  }
  for (const e of edges) {
    const s = byId.get(e.source), t = byId.get(e.target);
    if (!s || !t) { add({ severity: 'error', source: 'cable', code: 'TOPO_DANGLING_EDGE', message: `Cable ${e.id} points at a node that no longer exists.`, edgeId: e.id }); continue; }
    const { verdict } = checkCable(s, t, e.data?.kind, e.data?.access ?? 'read');
    if (!verdict.ok) add({ severity: 'error', source: 'cable', code: verdict.code, message: `${s.data.label} → ${t.data.label}: ${verdict.reason}`, edgeId: e.id, nodeId: s.id });
  }
  return out.sort((a, b) => Number(b.severity === 'error') - Number(a.severity === 'error'));
}
export const errorCount = (p: Problem[]) => p.filter((x) => x.severity === 'error').length;
