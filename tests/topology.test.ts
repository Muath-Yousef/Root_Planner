import { describe, expect, it } from 'vitest';
import { checkCable, checkConnection, compatibleNodes } from '../src/engine/cablingValidator';
import { collectProblems, errorCount } from '../src/engine/problems';
import { dockTemplates, getRole, listRoles, registerRoles, unregisterRole, type RoleDefinition } from '../src/registry';
import { templateNodeData } from '../src/engine/employeeFactory';
import { ref, node } from './helpers';

describe('cabling rules are data read by cablingValidator (§1.5, §4.2.1)', () => {
  const { nodes, edges } = ref();
  it('drafter network egress is rejected with POL_DRF_HARD_01 and a fix', () => {
    const r = checkCable(node(nodes, 'drf'), node(nodes, 'web'));
    expect(r.verdict).toMatchObject({ ok: false, code: 'POL_DRF_HARD_01' });
    if (!r.verdict.ok) expect(r.verdict.fix).toBeTruthy();
  });
  it('evaluator cannot reach the network either; every employee must go through SSRFGuard', () => {
    expect(checkCable(node(nodes, 'eva'), node(nodes, 'ssrf'), 'EGRESS_NETWORK').verdict).toMatchObject({ ok: false, code: 'POL_DRF_HARD_01' });
    expect(checkCable(node(nodes, 'scout'), node(nodes, 'web'), 'EGRESS_NETWORK').verdict).toMatchObject({ ok: false, code: 'POL_DEFAULT_DENY' });
    expect(checkCable(node(nodes, 'scout'), node(nodes, 'ssrf'), 'EGRESS_NETWORK').verdict.ok).toBe(true);
  });
  it('memory cables follow ROLE_PERMISSIONS (§4.2.1): evaluator may read but not write vectors, nobody but allowed roles touches L4', () => {
    expect(checkCable(node(nodes, 'eva'), node(nodes, 'l3'), 'MEMORY_BUS', 'read').verdict.ok).toBe(true);
    expect(checkCable(node(nodes, 'eva'), node(nodes, 'l3'), 'MEMORY_BUS', 'write').verdict).toMatchObject({ ok: false, code: 'POL_RBAC_DENY' });
    expect(checkCable(node(nodes, 'ctx'), node(nodes, 'l3'), 'MEMORY_BUS', 'read').verdict.ok).toBe(true);
    expect(checkCable(node(nodes, 'str'), node(nodes, 'l2'), 'MEMORY_BUS', 'write').verdict.ok).toBe(true);
  });
  it('a port mismatch is refused', () => expect(checkConnection(node(nodes, 'mgr'), node(nodes, 'scout'), 'out:TASK_DISPATCH_RESULT', 'in:KILL_PLANE_SIGNAL').verdict).toMatchObject({ code: 'POL_PORT_MISMATCH' }));
  it('compatible ports light up while dragging: scout egress can only land on SSRFGuard', () => {
    const ok = compatibleNodes(node(nodes, 'scout'), 'EGRESS_NETWORK', 'out', nodes);
    expect([...ok]).toEqual(['ssrf']);
  });
  it('every cable in the reference topology is valid and the department has zero problems', () => {
    for (const e of edges) expect(checkCable(node(nodes, e.source), node(nodes, e.target), e.data!.kind, e.data!.access).verdict.ok, e.id).toBe(true);
    expect(errorCount(collectProblems(nodes, edges, { tenant_id: 'socroot-core' }))).toBe(0);
  });
});

describe('problems collector', () => {
  it('reports a tenant mismatch, a duplicate id and a dangling cable', () => {
    const { nodes, edges } = ref();
    const dup = structuredClone(nodes); (dup.find((n) => n.id === 'ctx')!.data.employee!.contract as { employee_id: string }).employee_id = 'opp_acq.scout.v1';
    expect(collectProblems(dup, edges, { tenant_id: 'socroot-core' }).some((p) => p.code === 'ORG_DUPLICATE_ID')).toBe(true);
    expect(collectProblems(nodes, edges, { tenant_id: 'other-tenant' }).some((p) => p.code === 'POL_ABAC_TENANT')).toBe(true);
    expect(collectProblems(nodes.filter((n) => n.id !== 'ssrf'), edges, { tenant_id: 'socroot-core' }).some((p) => p.code === 'TOPO_DANGLING_EDGE')).toBe(true);
  });
  it('flags a CERTIFIED employee that lacks promotion evidence (EVA-001)', () => {
    const { nodes, edges } = ref(); const n = structuredClone(nodes); n.find((x) => x.id === 'scout')!.data.employee!.lifecycle = 'CERTIFIED';
    expect(collectProblems(n, edges, { tenant_id: 'socroot-core' }).some((p) => p.code === 'EVA-001')).toBe(true);
  });
});

describe('registry-driven extension: one definition adds a role everywhere', () => {
  const base = getRole('scout')!;
  const extra: RoleDefinition = { ...base, id: 'test_role', label: { en: 'Test Role', ar: 'دور تجريبي' }, description: { en: 'Added by one definition.', ar: 'أُضيف بتعريف واحد.' } };
  it('appears in the dock and builds a valid node without touching canvas or inspector code', () => {
    expect(dockTemplates('CURRENT', 'test role').length).toBe(0);
    registerRoles(extra);
    try {
      expect(dockTemplates('CURRENT', 'test role').map((r) => r.id)).toEqual(['test_role']);
      const d = templateNodeData('test_role', { prefix: 'x', department: 'd', manager_id: 'x.manager.v1', tenant_id: 'socroot-core' });
      expect(d.kind).toBe('employee'); expect(d.employee).toBeDefined();
    } finally { unregisterRole('test_role'); }
    expect(dockTemplates('CURRENT', 'test role').length).toBe(0);
  });
  it('horizon visibility is read from the component definition (TARGET roles hidden at CURRENT)', () => {
    expect(dockTemplates('CURRENT').some((r) => r.id === 'zone_dedicated')).toBe(false);
    expect(dockTemplates('TARGET').some((r) => r.id === 'zone_dedicated')).toBe(true);
  });
  it('the registry carries the 13 roles of §6.3.2 (12 employees + manager) and the orchestrator', () => {
    const ids = listRoles().filter((r) => r.employee).map((r) => r.id);
    expect(ids.filter((i) => i !== 'orchestrator').length).toBe(13); expect(ids).toContain('orchestrator');
  });
});
