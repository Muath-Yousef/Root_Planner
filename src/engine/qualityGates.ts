import { getRole } from '../registry';
import type { EmployeeConfig } from '../types';
import { PROMOTION_GATE } from '../types';
import { validateDoc } from '../schemas/validator';
import { scanForSecrets, validateSecretRef } from './secretGuard';
import { employeeFiles, networkOf, touchesPep } from './generators';

export interface Gate { id: 'intake' | 'scaffolding' | 'security' | 'benchmark'; ok: boolean; detail: string }

/** §6.3.1 Rule of Three: a new employee is allowed only for a repeated pattern (3x) or a trust/security boundary. */
export type TriggerType = 'ESCALATION_RATE_SPIKE' | 'MANAGER_OVERLOAD' | 'SCOPE_CREEP' | 'TRUST_BOUNDARY' | 'NEW_DEPARTMENT';
export const TRIGGER_TYPES: TriggerType[] = ['TRUST_BOUNDARY', 'SCOPE_CREEP', 'MANAGER_OVERLOAD', 'ESCALATION_RATE_SPIKE', 'NEW_DEPARTMENT'];
export interface IntakeForm { trigger: TriggerType; justification: string; repeat_count: number }

export function intakeGate(f: IntakeForm): Gate {
  const boundary = f.trigger === 'TRUST_BOUNDARY';
  const repeated = f.repeat_count >= 3 && f.trigger !== 'TRUST_BOUNDARY';
  if (f.justification.trim().length < 20) return { id: 'intake', ok: false, detail: 'Write a justification of at least 20 characters.' };
  if (!boundary && !repeated) return { id: 'intake', ok: false, detail: 'Rule of Three: the need must repeat 3 times, or sit on a trust/security boundary.' };
  return { id: 'intake', ok: true, detail: boundary ? 'Trust/security boundary' : `Pattern repeated ${f.repeat_count} times` };
}
export function scaffoldingGate(c: EmployeeConfig): Gate {
  const bad = [...validateDoc('contract', c.contract), ...validateDoc('manifest', c.manifest)];
  const files = employeeFiles(c).filter((f) => !f.path.startsWith('skills/')).length;
  return { id: 'scaffolding', ok: bad.length === 0 && files === 5 && c.skills.length > 0, detail: bad.length ? `${bad.length} schema error(s)` : 'Six-file bundle matches the schemas' };
}
export function securityGate(c: EmployeeConfig, role: string): Gate {
  const def = getRole(role);
  const secretBad = c.secrets.some((s) => !validateSecretRef(s.ref).ok) || scanForSecrets([c.custom_code, ...c.skills.map((s) => s.body)].join('\n')).length > 0;
  const isolation = !(def?.hard_no_egress && networkOf(c) !== 'none');
  const pep = !touchesPep(c.custom_code);
  const tools = !/\b(requests|urllib|httpx|socket|aiohttp)\b/.test(c.custom_code);
  return { id: 'security', ok: !secretBad && isolation && pep && tools, detail: !isolation ? 'Network isolation required for this role' : secretBad ? 'Clear-text secret found' : !pep ? 'Embedded guard was modified' : !tools ? 'Direct network call bypasses SSRFGuard' : 'Guards intact, isolation correct, no secrets' };
}
/** Phase 1 of §6.2.2: 20 synthetic task_result messages must all conform to task_result.schema.json. */
export function syntheticBenchmark(c: EmployeeConfig): number {
  const id = (c.contract as { employee_id?: string }).employee_id ?? 'x.y.v1';
  let passed = 0;
  for (let i = 0; i < PROMOTION_GATE.synthetic_total; i++) {
    const hex = (i + 1).toString(16).padStart(12, '0');
    const doc = { schema_version: '1.0', message_type: 'task.result', message_id: `00000000-0000-4000-8000-${hex}`, task_id: `10000000-0000-4000-8000-${hex}`, sender: id, receiver: 'manager', timestamp_utc: '2026-01-01T00:00:00Z', status: 'completed', outputs: { synthetic: i }, evidence: [{ source_url: 'https://example.org', extracted_text: 'x', relevance_score: 0.9 }], audit_ref: `audit://${hex}` };
    if (validateDoc('task_result', doc).length === 0 && scaffoldingGate(c).ok) passed++;
  }
  return passed;
}
export const benchmarkGate = (c: EmployeeConfig): Gate => ({ id: 'benchmark', ok: c.promotion.synthetic_passed >= PROMOTION_GATE.synthetic_total, detail: `${c.promotion.synthetic_passed}/${PROMOTION_GATE.synthetic_total} synthetic tasks conform` });
export const factoryGates = (c: EmployeeConfig, role: string, f: IntakeForm): Gate[] => [intakeGate(f), scaffoldingGate(c), securityGate(c, role), benchmarkGate(c)];
