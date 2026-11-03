import { getRole, type RoleDefinition } from '../registry';
import type { EmployeeConfig, NetworkMode, NodeData, SNode } from '../types';
import { AUTONOMY, DEPLOYMENT, LIFECYCLE, autonomyFromLevel, autonomyLevel, manifestLifecycleState } from '../types';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'x';
export const employeeId = (prefix: string, role: string, version = 1) => `${slug(prefix)}.${slug(role)}.v${version}`;
const NOW = () => new Date().toISOString();
const deptFolder = (dept: string) => `${slug(dept)}`;

export interface FactoryOptions { prefix: string; department: string; manager_id: string; tenant_id: string; version?: number; employee_id?: string; name?: string }

export function buildContract(def: RoleDefinition, o: FactoryOptions, id: string, network: NetworkMode, autonomy: number): Record<string, unknown> {
  const t = def.employee!;
  return {
    schema_version: '1.0', employee_id: id, name: o.name ?? t.name.en, role: def.id, version: `${o.version ?? 1}.0.0`,
    department: o.department, manager_id: o.manager_id, mission: t.mission, scope: [...t.scope], exclusions: [...t.exclusions],
    authority: { autonomy_level: autonomy, ...(def.id === 'evaluator' ? { decision_rule: { minimum_viable_score: 70.0, fast_track_threshold: 85.0, automatic_abort_threshold: 40.0 } } : {}) },
    tools: t.tools.map((x) => ({ ...x })), skills: t.skills.map((s) => `skills/${s.name}`), policies: [...t.policies],
    memory_config: { type: 'ephemeral', working_memory_max_tokens: 8000, wipe_on_completion: true },
    runtime_config: { docker_network: network, max_concurrent_tasks: t.runtime.max_concurrent_tasks, task_timeout_seconds: t.runtime.task_timeout_seconds },
    escalation_path: [{ level: 1, target_id: o.manager_id }, { level: 2, target_id: 'human.founder' }],
    identity_prompt: t.identity_prompt,
  };
}
export function buildManifest(c: Record<string, unknown>, cfg: Pick<EmployeeConfig, 'lifecycle' | 'autonomy' | 'secrets'>, tenant_id: string, created_at = NOW()): Record<string, unknown> {
  const rc = c.runtime_config as { docker_network: string };
  const env: Record<string, string> = { LOG_LEVEL: 'INFO', ENV: 'production', TENANT_ID: tenant_id };
  for (const s of cfg.secrets) if (s.name) env[`${s.name}_SECRET_REF`] = s.ref;
  const role = String(c.role);
  return {
    apiVersion: 'apps/v1', kind: 'EmployeeManifest',
    metadata: { employee_id: c.employee_id, version: c.version, department: c.department, manager_id: c.manager_id,
      contract_ref: `${deptFolder(String(c.department))}/employees/${role}/contract.json`, created_at, lifecycle_state: manifestLifecycleState(cfg.lifecycle, cfg.autonomy) },
    spec: {
      runtime: { image: `socroot/emp-${role.replace(/_/g, '-')}:${c.version}`, entrypoint: 'employee.py' },
      network: { mode: rc.docker_network, allowed_internal_hosts: rc.docker_network === 'none' ? [] : ['socroot-postgres', 'socroot-redis'] },
      environment: env, resources: { cpu_limit: '1000m', memory_limit: '512Mi' },
      health_check: { endpoint: '/health', test_command: `python -m ${deptFolder(String(c.department))}.employees.${role}.employee --health`, interval_seconds: 30, timeout_seconds: 5, retries: 3 },
      kill_switch: { auto_triggers: [{ condition: 'BUDGET_EXCEEDED', level: 'TASK', action: 'halt_task' }, { condition: 'POLICY_VIOLATION', level: 'EMPLOYEE', action: 'freeze_process' }, { condition: 'HEALTH_CHECK_FAILED_3X', level: 'EMPLOYEE', action: 'freeze_process' }] },
    },
  };
}
const CODE = '        # Role-specific logic goes here. The embedded guard above has already run.\n        return await self.run_default(task, ctx)\n';

export function makeEmployeeConfig(def: RoleDefinition, o: FactoryOptions): EmployeeConfig {
  const t = def.employee;
  if (!t) throw new Error(`Role ${def.id} is not an employee role`);
  const id = o.employee_id ?? employeeId(o.prefix, def.id, o.version ?? 1);
  const autonomy = autonomyFromLevel(t.autonomy_level);
  const contract = buildContract(def, o, id, def.network ?? 'internal', t.autonomy_level);
  const base = { lifecycle: LIFECYCLE.initial, deployment: DEPLOYMENT.initial, autonomy, secrets: (t.secrets ?? []).map((s) => ({ ...s })) };
  return {
    ...base, contract, manifest: buildManifest(contract, base, o.tenant_id),
    promotion: { synthetic_passed: 0, shadow_match_rate: 0, scorecard: Object.fromEntries(t.scorecard.map((k) => [k, 0])) },
    skills: t.skills.map((s) => ({ ...s })), custom_code: CODE,
  };
}
/** Fresh node data for any registry role. */
export function templateNodeData(roleId: string, o?: Partial<FactoryOptions> & { label?: string }): NodeData {
  const def = getRole(roleId);
  if (!def) throw new Error(`Unknown role ${roleId}`);
  const data: NodeData = { label: o?.label ?? def.label.en, kind: def.kind, role: def.id, status: def.implementation_status };
  if (def.network) data.networkMode = def.network;
  if (def.zone) data.zone = { ...def.zone };
  if (def.employee) data.employee = makeEmployeeConfig(def, { prefix: o?.prefix ?? 'new', department: o?.department ?? 'unassigned', manager_id: o?.manager_id ?? 'unassigned.manager.v1', tenant_id: o?.tenant_id ?? 'unassigned', ...o });
  return data;
}

type Contract = { employee_id?: string; runtime_config?: { docker_network?: string }; authority?: { autonomy_level?: number } };
/**
 * Keeps the three mirrors consistent after any edit. The contract is the source of truth for network mode and autonomy;
 * node.networkMode, manifest.spec.network.mode, manifest.metadata and the autonomy machine are derived from it.
 */
export function reconcileNode(node: SNode, tenant_id: string): SNode {
  const emp = node.data.employee;
  if (!emp) return node;
  const c = emp.contract as Contract;
  const mode = (['internal', 'isolated', 'none'] as const).find((m) => m === c.runtime_config?.docker_network) ?? node.data.networkMode;
  const lvl = c.authority?.autonomy_level;
  const autonomy = typeof lvl === 'number' && Number.isInteger(lvl) && lvl >= 1 && lvl <= 5 ? autonomyFromLevel(lvl) : emp.autonomy;
  const m = emp.manifest as { metadata?: Record<string, unknown>; spec?: { network?: Record<string, unknown>; environment?: Record<string, unknown> } };
  const fresh = buildManifest(emp.contract, { lifecycle: emp.lifecycle, autonomy, secrets: emp.secrets }, tenant_id, String(m.metadata?.created_at ?? NOW()));
  // Keep user-edited manifest parts that the studio does not derive.
  const fs = (fresh.spec as Record<string, unknown>);
  const spec = { ...fs, ...(m.spec ?? {}), network: { ...(fs.network as object), mode }, environment: { ...(m.spec?.environment ?? {}), ...(fs.environment as object) } };
  const manifest = { ...fresh, metadata: { ...(m.metadata ?? {}), ...(fresh.metadata as object) }, spec };
  return { ...node, data: { ...node.data, networkMode: mode, employee: { ...emp, autonomy, manifest } } };
}
export { AUTONOMY, autonomyLevel };
