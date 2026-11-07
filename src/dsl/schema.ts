import type { RoleDefinition } from '../registry';
import type { CableKind, Horizon, ImplementationStatus, IsolationMode } from '../types';

/**
 * The YAML topology spec (Phase 1). One document, five sections:
 *
 *   project:  id / name / tenant / horizon (+ optional created_at for a
 *             deterministic build — the v3 example pins it so compiling the
 *             file alone reproduces the delivered hash).
 *   defaults: factory defaults shared by every employee node (department,
 *             manager id, employee-id prefix).
 *   roles:    where the custom roles come from (a file reference, documentary
 *             only in Phase 1) and which role ids are custom.
 *   configs:  the three v2 config slots; each value is either the literal
 *             `preset` (resolved from src/dsl/presets.ts) or inline text.
 *   nodes:    a flat list in file order — the compiler keeps document order,
 *             exactly like the generator it replaces. A node with `parent:`
 *             becomes a child of that zone (parentId + extent 'parent').
 *   edges:    one entry per edge, or one entry per fan-out / zip (see EdgeSpec).
 *
 * Deliberately NOT in Phase 1 (later phases): no auto-layout — `at` is
 * required on every node (Phase 2); no `lines:` abstraction — repeated lines
 * are written out (Phase 3); no CLI or file loading for custom roles — the
 * definitions are passed to the compiler as an option (Phase 4).
 */
export interface ProjectSpec {
  id: string;
  name: string;
  /** tenant_id. */
  tenant: string;
  tenant_name?: string;
  isolation?: IsolationMode;
  horizon: Horizon;
  /** Pinned build time. The compiler option `now` overrides it. */
  created_at?: string;
}

export interface DefaultsSpec {
  department?: string;
  manager?: string;
  prefix?: string;
}

export interface RolesSpec {
  /** Path to the file the custom role definitions come from. Documentary in
   *  Phase 1: the compiler does not load it; the caller passes the
   *  definitions via the `customRoles` compiler option (Phase 4 wires file
   *  loading). */
  source?: string;
  /** Role ids that are custom (not in the studio registry). */
  custom?: string[];
}

export interface NodeSpec {
  id: string;
  role: string;
  /** Explicit position [x, y]. Required in Phase 1 (no auto-layout yet). */
  at: [number, number];
  /** Defaults to the role definition's English label (the factory's rule). */
  label?: string;
  /** Defaults to the role definition's implementation_status. */
  status?: ImplementationStatus;
  /** Employee-id prefix; defaults to defaults.prefix ('inf'). */
  prefix?: string;
  /** Passed to the employee factory; defaults to `<prefix>.<role>.v1`. */
  employee_id?: string;
  /** Contract name; defaults to the role's English name. */
  name?: string;
  /** Zone size [width, height] → style + zIndex -1. Zones only. */
  size?: [number, number];
  /** Appended to data.zone. Zones only. */
  department_id?: string;
  /** Id of the enclosing zone node → parentId + extent 'parent'. */
  parent?: string;
}

export interface EdgeSpec {
  from: string | string[];
  to: string | string[];
  kind: CableKind;
  /** MEMORY_BUS only; defaults to 'read' (the mkEdge rule). */
  access?: 'read' | 'write';
}

/**
 * Edge expansion. A single string on each side is one edge. A list on ONE
 * side fans out (one edge per entry, in listed order). Lists on BOTH sides
 * zip pairwise and must have equal length — e.g. three drafters to their
 * three creator profiles in one line.
 */
export interface TopologySpec {
  project: ProjectSpec;
  defaults?: DefaultsSpec;
  roles?: RolesSpec;
  /** If omitted, all three slots resolve to their presets. The emitted
   *  configs object is always in canonical v2 order (model_routing,
   *  sources_watchlist, pricing_config), whatever order the YAML lists. */
  configs?: Record<string, string>;
  nodes: NodeSpec[];
  edges: EdgeSpec[];
}

export interface CompileOptions {
  /** Build time. Overrides spec.project.created_at; pass a fixed value for a
   *  deterministic build (same input → same bytes). */
  now?: string;
  /** RoleDefinitions for the ids declared under roles.custom. The compiler
   *  never registers them in the global registry — it looks them up here. */
  customRoles?: RoleDefinition[];
}
