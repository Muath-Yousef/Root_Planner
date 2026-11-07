import { describe, expect, it } from 'vitest';
import { validateDoc } from '../src/schemas/validator';
import { listRoles } from '../src/registry';
import { makeEmployeeConfig } from '../src/engine/employeeFactory';

const U = '660e8400-e29b-41d4-a716-446655440001';
const result = () => ({
  schema_version: '1.0', message_type: 'task.result', message_id: U, task_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', sender: 'opp_acq.evaluator.v1',
  receiver: 'opp_acq.manager.v1', timestamp_utc: '2025-01-15T09:35:00Z', status: 'completed',
  outputs: { fit_score: 78.5 }, evidence: [{ source_url: 'https://www.ycombinator.com/rfs', extracted_text: 'x', relevance_score: 0.92 }], audit_ref: 'audit://a1b2c3d4-e5f6-7890-abcd-ef1234567890',
});
const escalation = () => ({
  schema_version: '1.0', message_type: 'escalation.package', escalation_id: 'esc-7f3a2b1c9d4e', task_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  sender: 'opp_acq.manager.v1', receiver: 'human.founder', timestamp_utc: '2025-01-15T09:38:00Z', reason_code: 'SCORE_AMBIGUOUS', urgency: 'MEDIUM',
  context: { fit_score: 62.3 }, evidence: [{ source_url: 'https://x' }], actions_taken: ['halted'], recommended_human_action: 'review', estimated_fix_cost_usd: 0.05, potential_grant_value_usd: 125000,
});
const dispatch = () => ({
  schema_version: '1.0', message_type: 'task.dispatch', message_id: U, task_id: U, sender: 'opp_acq.manager.v1', receiver: 'opp_acq.scout.v1', timestamp_utc: '2025-01-15T09:30:00Z',
  objective: 'scan sources', constraints: { deadline_utc: '2025-01-15T10:00:00Z', cost_budget_usd: 0.1, autonomy_level: 2 }, inputs: {}, expected_outputs: ['candidates'], escalation_path: [{ level: 1, target_id: 'opp_acq.manager.v1' }],
});
const route = () => ({
  schema_version: '1.0', message_type: 'objective.route', message_id: U, objective_id: U, sender: 'human.founder', receiver: 'core.orchestrator.v1', timestamp_utc: '2025-01-15T09:00:00Z',
  objective: { description: 'find grants', priority: 'high', deadline_utc: '2025-02-01T00:00:00Z', success_criteria: ['3 candidates'] }, dependencies: [], parallel_objectives: [],
});

describe('the six reference schemas (§2.2, verbatim, Draft 2020-12)', () => {
  it('accept valid documents', () => {
    expect(validateDoc('task_result', result())).toEqual([]);
    expect(validateDoc('escalation_package', escalation())).toEqual([]);
    expect(validateDoc('task_dispatch', dispatch())).toEqual([]);
    expect(validateDoc('objective_route', route())).toEqual([]);
  });
  it('task_result: status enum and audit_ref pattern, with the offending field named', () => {
    expect(validateDoc('task_result', { ...result(), status: 'aborted' })[0]).toMatchObject({ field: 'status', keyword: 'enum' });
    expect(validateDoc('task_result', { ...result(), audit_ref: 'bad' })[0]).toMatchObject({ field: 'audit_ref', keyword: 'pattern' });
  });
  it('escalation_package: closed reason_code enum', () => expect(validateDoc('escalation_package', { ...escalation(), reason_code: 'WHATEVER' })[0].field).toBe('reason_code'));
  it('task_dispatch: autonomy_level range and missing fields', () => {
    const bad = { ...dispatch(), constraints: { deadline_utc: '2025-01-15T10:00:00Z', cost_budget_usd: 0.1, autonomy_level: 9 } };
    expect(validateDoc('task_dispatch', bad)[0].field).toBe('constraints.autonomy_level');
    const { objective: _o, ...rest } = dispatch();
    expect(validateDoc('task_dispatch', rest).map((i) => i.field)).toContain('objective');
  });
  it('objective_route: priority enum', () => expect(validateDoc('objective_route', { ...route(), objective: { ...route().objective, priority: 'urgent' } })[0].field).toBe('objective.priority'));
  it('contract and manifest: every employee role in the registry generates documents that validate', () => {
    const roles = listRoles().filter((r) => r.employee);
    expect(roles.length).toBe(17); // the 13 roles of §6.3.2 plus core.orchestrator.v1 plus the 3 influencer roles (Phase 4)
    expect(roles.map((r) => r.id)).toEqual(expect.arrayContaining(['collector', 'content_selector', 'creator']));
    for (const def of roles) {
      const c = makeEmployeeConfig(def, { prefix: 'opp_acq', department: 'dept_opportunity_acquisition', manager_id: 'opp_acq.manager.v1', tenant_id: 'socroot-core' });
      expect(validateDoc('contract', c.contract), def.id).toEqual([]);
      expect(validateDoc('manifest', c.manifest), def.id).toEqual([]);
    }
  });
  it('contract: a bad docker_network is reported at its field', () => {
    const def = listRoles().find((r) => r.id === 'scout')!;
    const c = makeEmployeeConfig(def, { prefix: 'a', department: 'd', manager_id: 'a.manager.v1', tenant_id: 'socroot-core' });
    const bad = { ...c.contract, runtime_config: { ...(c.contract.runtime_config as object), docker_network: 'public' } };
    expect(validateDoc('contract', bad)[0]).toMatchObject({ field: 'runtime_config.docker_network', keyword: 'enum' });
  });
});
