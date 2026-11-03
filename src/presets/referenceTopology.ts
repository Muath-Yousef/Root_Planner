import { mkEdge } from '../registry';
import { templateNodeData } from '../engine/employeeFactory';
import type { CableKind, SEdge, SNode } from '../types';

export interface Topology { nodes: SNode[]; edges: SEdge[] }
const DEPT = 'dept_opportunity_acquisition';

/** Reference department dept_opportunity_acquisition (MASTER_REFERENCE §6.5, §1.2.1). Node ids are stable. */
export function buildReferenceTopology(tenant_id = 'socroot-core'): Topology {
  const o = (prefix: string, role: string) => ({ prefix, department: prefix === 'core' ? 'core' : DEPT, manager_id: `${prefix === 'core' ? 'core' : 'opp_acq'}.manager.v1`, tenant_id });
  const mk = (id: string, role: string, x: number, y: number, extra: Partial<SNode> = {}, opts: Record<string, unknown> = {}): SNode =>
    ({ id, type: role.startsWith('zone_') ? 'zone' : 'studio', position: { x, y }, data: templateNodeData(role, { ...(role.startsWith('zone_') ? {} : o(String(opts.prefix ?? 'opp_acq'), role)), ...opts }), ...extra });
  const zone = mk('zone_dept', 'zone_line', 470, -40, { style: { width: 560, height: 640 }, zIndex: -1 }, { label: DEPT });
  zone.data = { ...zone.data, zone: { ...zone.data.zone!, department_id: DEPT } };
  const child = (id: string, role: string, x: number, y: number) => mk(id, role, x, y, { parentId: 'zone_dept', extent: 'parent' });
  const untrusted = mk('zone_web', 'zone_untrusted', 1380, -30, { style: { width: 260, height: 200 }, zIndex: -1 });
  const nodes: SNode[] = [
    mk('founder', 'founder', 0, 260),
    mk('orch', 'orchestrator', 230, 260, {}, { prefix: 'core' }),
    zone,
    child('mgr', 'manager', 30, 270),
    child('scout', 'scout', 320, 40), child('ctx', 'context', 320, 170), child('eva', 'evaluator', 320, 300),
    child('str', 'strategist', 320, 430), child('drf', 'drafter', 320, 540),
    mk('ssrf', 'ssrf_guard', 1130, 40), untrusted, { ...mk('web', 'external', 40, 70), parentId: 'zone_web', extent: 'parent' },
    mk('l3', 'l3', 1130, 190), mk('l2', 'l2', 1130, 330),
    mk('pe', 'policy_engine', 1130, 470), mk('bg', 'budget_guard', 1130, 560),
    mk('kill', 'kill_switch', 470, 700),
  ];
  const e = (s: string, t: string, k: CableKind, a?: 'read' | 'write') => mkEdge(s, t, k, a);
  const edges: SEdge[] = [
    e('founder', 'orch', 'OBJECTIVE_ROUTE'), e('orch', 'mgr', 'OBJECTIVE_ROUTE'),
    ...['scout', 'ctx', 'eva', 'str', 'drf'].map((id) => e('mgr', id, 'TASK_DISPATCH_RESULT')),
    e('mgr', 'founder', 'ESCALATION_PATH'),
    e('scout', 'ssrf', 'EGRESS_NETWORK'), e('ssrf', 'web', 'EGRESS_NETWORK'),
    e('ctx', 'l3', 'MEMORY_BUS', 'read'), e('str', 'l2', 'MEMORY_BUS', 'read'), e('kill', 'mgr', 'KILL_PLANE_SIGNAL'),
  ];
  return { nodes, edges };
}
const ref = buildReferenceTopology();
export const referenceNodes = ref.nodes;
export const referenceEdges = ref.edges;
