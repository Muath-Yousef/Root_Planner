import type { CableKind, NodeKind } from '../types';
import type { PortDef } from './definitions';
const p = (direction: 'in' | 'out', cable: CableKind): PortDef => ({ id: `${direction}:${cable}`, cable, direction });
/** Default typed ports per node kind. A RoleDefinition may override with `ports`. */
export const DEFAULT_PORTS: Record<NodeKind, PortDef[]> = {
  founder: [p('in', 'ESCALATION_PATH'), p('out', 'OBJECTIVE_ROUTE')],
  orchestrator: [p('in', 'OBJECTIVE_ROUTE'), p('out', 'OBJECTIVE_ROUTE'), p('in', 'KILL_PLANE_SIGNAL')],
  manager: [p('in', 'OBJECTIVE_ROUTE'), p('in', 'TASK_DISPATCH_RESULT'), p('in', 'ESCALATION_PATH'), p('in', 'KILL_PLANE_SIGNAL'),
    p('out', 'TASK_DISPATCH_RESULT'), p('out', 'ESCALATION_PATH'), p('out', 'MEMORY_BUS')],
  employee: [p('in', 'TASK_DISPATCH_RESULT'), p('in', 'KILL_PLANE_SIGNAL'), p('out', 'TASK_DISPATCH_RESULT'), p('out', 'ESCALATION_PATH'), p('out', 'MEMORY_BUS'), p('out', 'EGRESS_NETWORK')],
  guard: [p('in', 'EGRESS_NETWORK'), p('out', 'EGRESS_NETWORK'), p('out', 'KILL_PLANE_SIGNAL')],
  memory: [p('in', 'MEMORY_BUS')],
  external: [p('in', 'EGRESS_NETWORK')],
  zone: [],
};
export const parsePort = (handle: string | null | undefined): { direction: 'in' | 'out'; cable: CableKind } | null => {
  if (!handle) return null;
  const [direction, cable] = handle.split(':');
  return (direction === 'in' || direction === 'out') && cable ? { direction, cable: cable as CableKind } : null;
};
