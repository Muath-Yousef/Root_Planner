import { load } from 'js-yaml';
import { CABLE_KINDS, getRole, mkEdge } from '../registry';
import type { RoleDefinition } from '../registry';
import { makeEmployeeConfig, templateNodeData } from '../engine/employeeFactory';
import { CURRENT_FORMAT_VERSION } from '../schemas/project';
import type { CableKind, ImplementationStatus, ProjectFile, SEdge, SNode } from '../types';
import { CONFIG_KEYS, CONFIG_PRESETS, type ConfigKey } from './presets';
import type { CompileOptions, EdgeSpec, NodeSpec, TopologySpec } from './schema';

/**
 * Phase 1 — YAML DSL compiler (YAML → ProjectFile, format v2).
 *
 * The compiler is a declarative interpreter over the studio's own factory:
 * registry roles go through templateNodeData, custom roles through
 * makeEmployeeConfig with the same literal data shape the v3 generator's
 * mkCustom/mkLine build, edges go through mkEdge, and the file is produced
 * with the same field order the generator uses — so a YAML spec of v3
 * compiles to the delivered v3 file byte-identically (see
 * tests/dsl-compiler.test.ts).
 *
 * The compiler does STRUCTURAL validation only (unknown role, unknown node
 * id, bad kind, duplicate id, missing config…) with errors that name the
 * line and the field. Topology validation stays where it belongs: the
 * studio's own checkCable / collectProblems / parseProjectText judge the
 * output — the compiler invents no parallel validator.
 */

export class DslError extends Error {
  readonly line?: number;
  readonly field?: string;
  constructor(message: string, opts?: { line?: number; field?: string }) {
    super(opts?.line !== undefined ? `سطر ${opts.line} — ${message}` : message);
    this.name = 'DslError';
    this.line = opts?.line;
    this.field = opts?.field;
  }
}

const STATUSES: ImplementationStatus[] = ['IMPLEMENTED', 'PARTIAL', 'PLANNED', 'TRIGGER_BASED', 'DEPRECATED'];

/** Best-effort line lookup: first source line containing the needle (1-based). */
function findLine(source: string, needle: string): number | undefined {
  const idx = source.split('\n').findIndex((l) => l.includes(needle));
  return idx >= 0 ? idx + 1 : undefined;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function fail(source: string, message: string, field?: string, needle?: string): never {
  throw new DslError(message, { field, line: needle !== undefined ? findLine(source, needle) : undefined });
}

function reqString(obj: Record<string, unknown>, key: string, where: string, source: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v === '') fail(source, `الحقل "${key}" في ${where} مطلوب ويجب أن يكون نصاً غير فارغ`, `${where}.${key}`);
  return v as string;
}

function optString(obj: Record<string, unknown>, key: string, where: string, source: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string') fail(source, `الحقل "${key}" في ${where} يجب أن يكون نصاً`, `${where}.${key}`);
  return v;
}

function reqPair(obj: Record<string, unknown>, key: string, where: string, source: string): [number, number] {
  const v = obj[key];
  if (!Array.isArray(v) || v.length !== 2 || typeof v[0] !== 'number' || typeof v[1] !== 'number') {
    fail(source, `الحقل "${key}" في ${where} يجب أن يكون زوجاً من الأرقام [x, y]`, `${where}.${key}`);
  }
  return v as [number, number];
}

function asIdList(v: unknown, field: string, where: string, source: string): string[] {
  const list = Array.isArray(v) ? v : [v];
  for (const id of list) {
    if (typeof id !== 'string' || id === '') fail(source, `الحقل "${field}" في ${where} يجب أن يكون معرف عقدة أو قائمة معرفات`, field);
  }
  return list as string[];
}

/** Structural validation of the parsed YAML. Returns the typed spec. */
function validateSpec(raw: unknown, source: string): TopologySpec {
  if (!isRecord(raw)) fail(source, 'ملف YAML يجب أن يكون خريطة (mapping) في مستواه الأعلى', 'top');
  const project = raw.project;
  if (!isRecord(project)) fail(source, 'قسم "project" مطلوب ويجب أن يكون خريطة', 'project');
  const id = reqString(project, 'id', 'project', source);
  const name = reqString(project, 'name', 'project', source);
  const tenant = reqString(project, 'tenant', 'project', source);
  const tenantName = optString(project, 'tenant_name', 'project', source);
  const horizon = reqString(project, 'horizon', 'project', source);
  if (!['CURRENT', 'TRANSITIONAL', 'TARGET'].includes(horizon)) {
    fail(source, `الأفق "${horizon}" غير معروف — القيم المقبولة: CURRENT أو TRANSITIONAL أو TARGET`, 'project.horizon', `horizon: ${horizon}`);
  }
  const isolation = optString(project, 'isolation', 'project', source);
  if (isolation !== undefined && !['logical_rls', 'dedicated'].includes(isolation)) {
    fail(source, `العزل "${isolation}" غير معروف — القيم المقبولة: logical_rls أو dedicated`, 'project.isolation', `isolation: ${isolation}`);
  }
  const createdAt = optString(project, 'created_at', 'project', source);

  let defaults: TopologySpec['defaults'];
  if (raw.defaults !== undefined) {
    if (!isRecord(raw.defaults)) fail(source, 'قسم "defaults" يجب أن يكون خريطة', 'defaults');
    defaults = {
      department: optString(raw.defaults, 'department', 'defaults', source),
      manager: optString(raw.defaults, 'manager', 'defaults', source),
      prefix: optString(raw.defaults, 'prefix', 'defaults', source),
    };
  }

  let roles: TopologySpec['roles'];
  if (raw.roles !== undefined) {
    if (!isRecord(raw.roles)) fail(source, 'قسم "roles" يجب أن يكون خريطة', 'roles');
    const src = optString(raw.roles, 'source', 'roles', source);
    let custom: string[] | undefined;
    if (raw.roles.custom !== undefined) {
      if (!Array.isArray(raw.roles.custom) || raw.roles.custom.some((r) => typeof r !== 'string')) {
        fail(source, 'الحقل "custom" في roles يجب أن يكون قائمة معرفات أدوار', 'roles.custom');
      }
      custom = raw.roles.custom as string[];
    }
    roles = { source: src, custom };
  }

  let configs: Record<string, string> | undefined;
  if (raw.configs !== undefined) {
    if (!isRecord(raw.configs)) fail(source, 'قسم "configs" يجب أن يكون خريطة', 'configs');
    for (const key of Object.keys(raw.configs)) {
      if (!(CONFIG_KEYS as readonly string[]).includes(key)) {
        fail(source, `مفتاح الإعدادات "${key}" غير معروف — المفاتيح المقبولة: ${CONFIG_KEYS.join('، ')}`, `configs.${key}`, `${key}:`);
      }
      if (typeof raw.configs[key] !== 'string') {
        fail(source, `قيمة الإعداد "${key}" يجب أن تكون نصاً ("preset" أو نصاً مضمّناً)`, `configs.${key}`, `${key}:`);
      }
    }
    for (const key of CONFIG_KEYS) {
      if (!(key in raw.configs)) fail(source, `الإعداد "${key}" مفقود — ملف المشروع v2 يتطلب الإعدادات الثلاثة`, `configs.${key}`);
    }
    configs = raw.configs as Record<string, string>;
  }

  if (!Array.isArray(raw.nodes) || raw.nodes.length === 0) fail(source, 'قسم "nodes" مطلوب ويجب أن يكون قائمة غير فارغة', 'nodes');
  const nodes: NodeSpec[] = raw.nodes.map((entry, i) => {
    const where = `nodes[${i}]`;
    if (!isRecord(entry)) fail(source, `العقدة في ${where} يجب أن تكون خريطة`, where);
    const nid = reqString(entry, 'id', where, source);
    const role = reqString(entry, 'role', where, source);
    const at = reqPair(entry, 'at', where, source);
    const label = optString(entry, 'label', where, source);
    const status = optString(entry, 'status', where, source);
    if (status !== undefined && !(STATUSES as readonly string[]).includes(status)) {
      fail(source, `الحالة "${status}" للعقدة "${nid}" غير معروفة — القيم المقبولة: ${STATUSES.join('، ')}`, `${where}.status`, `id: ${nid}`);
    }
    const node: NodeSpec = {
      id: nid, role, at, label, status: status as ImplementationStatus | undefined,
      prefix: optString(entry, 'prefix', where, source),
      employee_id: optString(entry, 'employee_id', where, source),
      name: optString(entry, 'name', where, source),
      department_id: optString(entry, 'department_id', where, source),
      parent: optString(entry, 'parent', where, source),
    };
    if (entry.size !== undefined) node.size = reqPair(entry, 'size', where, source);
    return node;
  });

  if (!Array.isArray(raw.edges)) fail(source, 'قسم "edges" مطلوب ويجب أن يكون قائمة (ولو فارغة)', 'edges');
  const edges: EdgeSpec[] = raw.edges.map((entry, i) => {
    const where = `edges[${i}]`;
    if (!isRecord(entry)) fail(source, `الرابط في ${where} يجب أن يكون خريطة`, where);
    const from = asIdList(entry.from, `${where}.from`, where, source);
    const to = asIdList(entry.to, `${where}.to`, where, source);
    const kind = reqString(entry, 'kind', where, source);
    if (!(CABLE_KINDS as readonly string[]).includes(kind)) {
      fail(source, `نوع الكابل "${kind}" غير معروف — الأنواع المقبولة: ${CABLE_KINDS.join('، ')}`, `${where}.kind`, `kind: ${kind}`);
    }
    const access = optString(entry, 'access', where, source);
    if (access !== undefined && !['read', 'write'].includes(access)) {
      fail(source, `الوصول "${access}" غير معروف — القيم المقبولة: read أو write`, `${where}.access`, `access: ${access}`);
    }
    if (access !== undefined && kind !== 'MEMORY_BUS') {
      fail(source, `الوصول "access" يخص MEMORY_BUS فقط — الرابط من نوع ${kind} لا يحمل وصولاً`, `${where}.access`, `access: ${access}`);
    }
    return { from: from.length === 1 ? from[0] : from, to: to.length === 1 ? to[0] : to, kind: kind as CableKind, access: access as 'read' | 'write' | undefined };
  });

  return {
    project: { id, name, tenant, tenant_name: tenantName, isolation: isolation as TopologySpec['project']['isolation'], horizon: horizon as TopologySpec['project']['horizon'], created_at: createdAt },
    defaults, roles, configs, nodes, edges,
  };
}

interface BuildCtx {
  source: string;
  now: string;
  tenantId: string;
  department: string;
  managerId: string;
  defaultPrefix: string;
  customIds: Set<string>;
  customById: Map<string, RoleDefinition>;
}

function factoryOptions(n: NodeSpec, ctx: BuildCtx): Parameters<typeof makeEmployeeConfig>[1] {
  return {
    prefix: n.prefix ?? ctx.defaultPrefix,
    department: ctx.department,
    manager_id: ctx.managerId,
    tenant_id: ctx.tenantId,
    created_at: ctx.now,
    ...(n.employee_id !== undefined ? { employee_id: n.employee_id } : {}),
    ...(n.name !== undefined ? { name: n.name } : {}),
  };
}

/**
 * Builds one node. Mirrors the v3 generator's mk/mkCustom/mkLine exactly:
 * registry roles via templateNodeData (label/status overridden afterwards,
 * as the generator's final loop does); custom roles via a literal data
 * object in the same key order (label, kind, role, networkMode, status,
 * employee); zones get style + zIndex -1; children get parentId + extent.
 */
function buildNode(n: NodeSpec, ctx: BuildCtx): SNode {
  const isZone = n.role.startsWith('zone_');
  if (n.size !== undefined && !isZone) {
    fail(ctx.source, `الحقل "size" يخص عقد المناطق فقط — العقدة "${n.id}" دورها ${n.role}`, `nodes.${n.id}.size`, `id: ${n.id}`);
  }
  if (n.department_id !== undefined && !isZone) {
    fail(ctx.source, `الحقل "department_id" يخص عقد المناطق فقط — العقدة "${n.id}" دورها ${n.role}`, `nodes.${n.id}.department_id`, `id: ${n.id}`);
  }
  const type = isZone ? 'zone' : 'studio';
  let data: SNode['data'];
  if (ctx.customIds.has(n.role)) {
    const def = ctx.customById.get(n.role)!;
    data = {
      label: n.label ?? def.label.en,
      kind: def.kind,
      role: def.id,
      networkMode: def.network ?? 'internal',
      status: n.status ?? def.implementation_status,
      employee: makeEmployeeConfig(def, factoryOptions(n, ctx)),
    } as unknown as SNode['data'];
  } else {
    const def = getRole(n.role);
    if (!def) {
      fail(ctx.source, `الدور "${n.role}" غير معروف — ليس في سجل الاستوديو ولا معلناً في roles.custom`, `nodes.${n.id}.role`, `role: ${n.role}`);
    }
    const opts = isZone
      ? { ...(n.label !== undefined ? { label: n.label } : {}) }
      : factoryOptions(n, ctx);
    data = templateNodeData(n.role, opts);
    if (n.label !== undefined) data.label = n.label;
    if (n.status !== undefined) data.status = n.status;
    if (n.department_id !== undefined && data.zone) {
      data.zone = { ...data.zone, department_id: n.department_id };
    }
  }
  const node = {
    id: n.id,
    type,
    position: { x: n.at[0], y: n.at[1] },
    data,
  } as SNode;
  if (isZone && n.size !== undefined) {
    node.style = { width: n.size[0], height: n.size[1] };
    node.zIndex = -1;
  }
  if (n.parent !== undefined) {
    node.parentId = n.parent;
    node.extent = 'parent';
  }
  return node;
}

/** One entry expands to one edge, a fan-out, or a pairwise zip. */
function expandEdge(e: EdgeSpec, source: string): Array<[string, string]> {
  const from = Array.isArray(e.from) ? e.from : [e.from];
  const to = Array.isArray(e.to) ? e.to : [e.to];
  if (from.length > 1 && to.length > 1) {
    if (from.length !== to.length) {
      fail(source, `الرابط ${from[0]} → ${to[0]}: قائمتا from (${from.length}) وto (${to.length}) مختلفتا الطول — التوسيع الثنائي يتطلب نفس العدد`, 'edges', `from: [${from.join(', ')}]`);
    }
    return from.map((f, i) => [f, to[i]] as [string, string]);
  }
  return from.flatMap((f) => to.map((t) => [f, t] as [string, string]));
}

/**
 * Compiles a YAML topology spec to a v2 ProjectFile.
 * Throws DslError (with line + field when known) on any structural problem.
 * The output still has to pass the studio's own validation — the caller (or
 * the tests) run parseProjectText / checkCable / collectProblems on it.
 */
export function compileTopology(source: string, options: CompileOptions = {}): ProjectFile {
  let raw: unknown;
  try {
    raw = load(source);
  } catch (e) {
    const err = e as Error & { mark?: { line?: number; column?: number } };
    const line = err.mark?.line !== undefined ? err.mark.line + 1 : undefined;
    throw new DslError(`تعذّر تحليل YAML: ${err.message}`, { line, field: 'yaml' });
  }
  const spec = validateSpec(raw, source);
  const now = options.now ?? spec.project.created_at ?? new Date().toISOString();
  const customById = new Map((options.customRoles ?? []).map((d) => [d.id, d]));
  const customIds = new Set(spec.roles?.custom ?? []);
  for (const id of customIds) {
    if (getRole(id)) {
      fail(source, `الدور "${id}" مسجّل أصلاً في الاستوديو — لا يمكن إعلانه دوراً مخصصاً في roles.custom`, 'roles.custom', `custom: [${[...customIds].join(', ')}]`);
    }
    if (!customById.has(id)) {
      fail(source, `الدور المخصص "${id}" معلن في roles.custom لكن لم يُمرَّر تعريفه إلى المترجم (خيار customRoles)`, 'roles.custom', `custom: [${[...customIds].join(', ')}]`);
    }
  }
  const ctx: BuildCtx = {
    source, now,
    tenantId: spec.project.tenant,
    department: spec.defaults?.department ?? 'unassigned',
    managerId: spec.defaults?.manager ?? 'unassigned.manager.v1',
    defaultPrefix: spec.defaults?.prefix ?? 'inf',
    customIds, customById,
  };
  const nodes: SNode[] = [];
  const byId = new Map<string, SNode>();
  for (const n of spec.nodes) {
    if (byId.has(n.id)) {
      fail(source, `معرف العقدة "${n.id}" مكرر — كل عقدة تحتاج معرفاً فريداً`, `nodes.${n.id}.id`, `id: ${n.id}`);
    }
    const node = buildNode(n, ctx);
    nodes.push(node);
    byId.set(n.id, node);
  }
  for (const n of spec.nodes) {
    if (n.parent === undefined) continue;
    const parent = byId.get(n.parent);
    if (!parent) {
      fail(source, `العقدة "${n.id}" تشير إلى أب "${n.parent}" غير موجود`, `nodes.${n.id}.parent`, `id: ${n.id}`);
    }
    if (!parent.data.role.startsWith('zone_')) {
      fail(source, `أب العقدة "${n.id}" هو "${n.parent}" ودوره ${parent.data.role} — الأب يجب أن يكون عقدة منطقة`, `nodes.${n.id}.parent`, `id: ${n.id}`);
    }
  }
  const edges: SEdge[] = [];
  for (const e of spec.edges) {
    for (const [s, t] of expandEdge(e, source)) {
      if (!byId.has(s)) fail(source, `مصدر الرابط "${s}" غير موجود بين العقد`, 'edges.from', `from: ${s}`);
      if (!byId.has(t)) fail(source, `هدف الرابط "${t}" غير موجود بين العقد`, 'edges.to', `to: ${t}`);
      edges.push(mkEdge(s, t, e.kind, e.access));
    }
  }
  const configEntries = spec.configs !== undefined
    ? (Object.entries(spec.configs) as Array<[ConfigKey, string]>)
    : CONFIG_KEYS.map((k) => [k, 'preset'] as [ConfigKey, string]);
  const resolved = new Map(
    configEntries.map(([key, value]) => [key, value === 'preset' ? CONFIG_PRESETS[key] : value]),
  );
  // Emitted in canonical v2 order regardless of YAML order (deterministic bytes).
  const configs: ProjectFile['configs'] = {
    model_routing: resolved.get('model_routing')!,
    sources_watchlist: resolved.get('sources_watchlist')!,
    pricing_config: resolved.get('pricing_config')!,
  };
  return {
    format_version: CURRENT_FORMAT_VERSION,
    app: 'socroot-topology-studio',
    id: spec.project.id,
    name: spec.project.name,
    tenant: { tenant_id: spec.project.tenant, isolation: spec.project.isolation ?? 'logical_rls', name: spec.project.tenant_name ?? spec.project.tenant },
    horizon: spec.project.horizon,
    created_at: now,
    updated_at: now,
    nodes,
    edges,
    configs,
  };
}
