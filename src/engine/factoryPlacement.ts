import type { XYPosition } from '@xyflow/react';
import { getRole, mkEdge } from '../registry';
import type { EmployeeConfig, SEdge, SNode } from '../types';
import { checkCable } from './cablingValidator';
import { employeeId, makeEmployeeConfig, templateNodeData } from './employeeFactory';
import { factoryGates, syntheticBenchmark, type Gate, type IntakeForm } from './qualityGates';

/**
 * Where a new employee goes and what the Employee Factory checks before it is added (§6.3, §6.8). Pure: the caller
 * decides what to do with the result. Nothing here knows a role by name; everything comes from the registry definition.
 */
export interface PlacementRequest {
  roleId: string; position: XYPosition; tenant_id: string; nodes: SNode[];
  name?: string; managerId?: string; zoneId?: string;
}
export interface Home { zone?: SNode; department: string; manager?: SNode; prefix: string; manager_id: string }

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'x';
const contractOf = (n: SNode) => (n.data.employee?.contract ?? {}) as { employee_id?: string; department?: string };
const numberOf = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const isDepartmentZone = (n: SNode) => n.data.kind === 'zone' && (n.data.zone?.zone === 'line' || n.data.zone?.zone === 'meta');
const zoneBox = (z: SNode) => ({ x: z.position.x, y: z.position.y, w: numberOf(z.style?.width) ?? 360, h: numberOf(z.style?.height) ?? 240 });

/** The department zone, the manager and the id prefix that a new employee at this spot belongs to. */
export function resolveHome(req: PlacementRequest): Home {
  const { nodes } = req;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const explicitManager = req.managerId ? byId.get(req.managerId) : undefined;
  let zone = req.zoneId ? byId.get(req.zoneId) : undefined;
  const pos = req.position ?? { x: 300, y: 200 };
  if (!zone) zone = nodes.find((z) => { if (!isDepartmentZone(z)) return false; const b = zoneBox(z); return pos.x >= b.x && pos.x <= b.x + b.w && pos.y >= b.y && pos.y <= b.y + b.h; });
  const managers = nodes.filter((n) => n.data.kind === 'manager' && n.data.employee);
  const manager = explicitManager ?? (zone ? managers.find((m) => m.parentId === zone!.id) : undefined)
    ?? (zone ? managers.find((m) => contractOf(m).department === (zone!.data.zone?.department_id ?? zone!.data.label)) : undefined);
  const department = zone?.data.zone?.department_id ?? (zone ? zone.data.label : undefined) ?? (manager ? contractOf(manager).department : undefined) ?? 'unassigned';
  const managerEmployeeId = manager ? contractOf(manager).employee_id : undefined;
  const prefix = managerEmployeeId ? managerEmployeeId.split('.')[0] : slug(department === 'unassigned' ? 'new' : department.replace(/^dept_/, ''));
  return { zone, department, manager, prefix, manager_id: managerEmployeeId ?? `${prefix}.manager.v1` };
}

/** First free `<prefix>.<role>.v<N>` among the employees already on the canvas. */
export function nextEmployeeId(prefix: string, role: string, nodes: SNode[]): string {
  const used = new Set(nodes.map((n) => contractOf(n).employee_id).filter((x): x is string => !!x));
  for (let v = 1; v < 1000; v++) { const id = employeeId(prefix, role, v); if (!used.has(id)) return id; }
  throw new Error(`No free employee id for ${prefix}.${role}`);
}

export type FactoryPreview = { error: string } | { id: string; config: EmployeeConfig; home: Home; gates: Gate[]; ready: boolean };

function buildConfig(req: PlacementRequest, home: Home): { id: string; config: EmployeeConfig } | { error: string } {
  const def = getRole(req.roleId);
  if (!def) return { error: `Unknown role ${req.roleId}.` };
  if (!def.employee || def.kind !== 'employee') return { error: `${def.label.en} is not an employee template, so the factory does not apply.` };
  const id = nextEmployeeId(home.prefix, def.id, req.nodes);
  const config = makeEmployeeConfig(def, { prefix: home.prefix, department: home.department, manager_id: home.manager_id, tenant_id: req.tenant_id, employee_id: id, name: req.name });
  // Gate 4 phase 1 (§6.2.2): the 20 synthetic task_result messages run at creation; shadow match comes later from real traffic.
  config.promotion = { ...config.promotion, synthetic_passed: syntheticBenchmark(config) };
  return { id, config };
}

/** Runs the Rule of Three and the four quality gates against the employee that would be created. Nothing is added. */
export function previewFactory(req: PlacementRequest, intake: IntakeForm): FactoryPreview {
  const home = resolveHome(req);
  const built = buildConfig(req, home);
  if ('error' in built) return built;
  const gates = factoryGates(built.config, req.roleId, intake);
  return { id: built.id, config: built.config, home, gates, ready: gates.every((g) => g.ok) };
}

export type Placement = { ok: true; node: SNode; edges: SEdge[]; config: EmployeeConfig } | { ok: false; reason: string };

/** The node (and the manager cable, when the cable rules allow it) for a new employee. `config` is built here when not given. */
export function placeEmployee(req: PlacementRequest, config?: EmployeeConfig): Placement {
  const home = resolveHome(req);
  let cfg = config;
  if (!cfg) { const built = buildConfig(req, home); if ('error' in built) return { ok: false, reason: built.error }; cfg = built.config; }
  const def = getRole(req.roleId);
  if (!def) return { ok: false, reason: `Unknown role ${req.roleId}.` };
  const id = `${req.roleId}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const data = templateNodeData(req.roleId, { prefix: home.prefix, department: home.department, manager_id: home.manager_id, tenant_id: req.tenant_id, employee_id: (cfg.contract as { employee_id?: string }).employee_id, name: req.name, label: req.name });
  data.employee = cfg;
  if (req.name?.trim()) data.label = req.name.trim();
  const zone = home.zone;
  const node: SNode = { id, type: 'studio', position: { ...req.position }, data };
  if (zone) {
    const b = zoneBox(zone);
    node.parentId = zone.id; node.extent = 'parent';
    node.position = { x: Math.max(8, Math.min(req.position.x - b.x, b.w - 200)), y: Math.max(8, Math.min(req.position.y - b.y, b.h - 80)) };
  }
  const edges: SEdge[] = [];
  if (home.manager && checkCable(home.manager, node, 'TASK_DISPATCH_RESULT').verdict.ok) edges.push(mkEdge(home.manager.id, id, 'TASK_DISPATCH_RESULT'));
  return { ok: true, node, edges, config: cfg };
}
