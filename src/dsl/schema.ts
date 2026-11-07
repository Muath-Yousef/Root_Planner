import type { RoleDefinition } from '../registry';
import type { CableKind, Horizon, ImplementationStatus, IsolationMode } from '../types';

/**
 * The YAML topology spec (Phases 1–3; layout in Phase 2, lines in Phase 3). One document:
 *
 *   project:  id / name / tenant / horizon (+ optional created_at for a
 *             deterministic build — the v3 example pins it so compiling the
 *             file alone reproduces the delivered hash).
 *   defaults: factory defaults shared by every employee node (department,
 *             manager id, employee-id prefix).
 *   roles:    where the custom roles come from (a file reference the
 *             Phase 4 CLI loads, relative to the repository root) and
 *             which role ids are custom.
 *   configs:  the three v2 config slots; each value is either the literal
 *             `preset` (resolved from src/dsl/presets.ts) or inline text.
 *   layout:   the grid the engine places `lane`/`row` nodes on (step_x,
 *             step_y, pad; defaults 320/170/40 — the v3 grid). Phase 2.
 *   lines:    ONE line template + a count (Phase 3): the template's nodes
 *             are instantiated once per line, with `{n}` = the line index
 *             (1-based). Anchors in `nodes` say where each template node's
 *             instances land in the emitted file order. `row_offset`
 *             (V4, default 0) shifts the whole line block down that many
 *             rows — `row: "{n}"` becomes n + row_offset, and `after-lines`
 *             becomes count + 1 + row_offset — so a header row (e.g. team
 *             managers at row 0) can sit above the lines without moving
 *             any template node by hand.
 *   nodes:    a flat list in file order — the compiler keeps document order,
 *             exactly like the generator it replaces. A node with `parent:`
 *             becomes a child of that zone (parentId + extent 'parent').
 *             A node is placed either by explicit `at:` (override) or by
 *             `lane:`/`row:` on the layout grid (Phase 2); exactly one of
 *             the two, never both, never neither. A `row` of `after-lines`
 *             means the first row after the line block (count + 1).
 *             A `{ lines: [...] }` entry is an anchor, not a node: it
 *             expands the listed template nodes here, line by line.
 *   edges:    one entry per edge, or one entry per fan-out / zip (see EdgeSpec).
 *             An endpoint containing `{n}` expands to every line's instance
 *             of that template node (see docs/DSL.md). Phase 6: an entry may
 *             carry `dispatch:` instead of `to:` — one or both bulk-dispatch
 *             rules (`department`, `line`) that expand to TASK_DISPATCH_RESULT
 *             edges at build time, in file order (see EdgeSpec).
 *
 * Deliberately NOT in Phase 3 (later phases): the compiler itself never
 * loads role files — the definitions are passed to it as an option. The
 * Phase 4 CLI (src/cli/) loads the file named in roles.source and passes
 * the definitions (see docs/ROLES.md). The top-level composition (founder / orchestrator / zone /
 * right column / web zone / kill switch) stays explicit `at:` positions:
 * only the grid rows know about the line count (`after-lines`); the
 * absolute positions of pe / bg / kill are correct for the authored
 * count and are the preset's job to shift for other counts (see
 * src/presets/portfolio.ts and docs/LAYOUT.md).
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
  /** Path to the file the custom role definitions come from, relative to
   *  the repository root. The compiler itself does not load it; the caller
   *  passes the definitions via the `customRoles` compiler option — the
   *  Phase 4 CLI (`src/cli/`) loads this file and passes them. */
  source?: string;
  /** Role ids built through the compiler's custom branch (literal node-data
   *  key order). A role listed here that the registry already holds is
   *  allowed only when the passed definition is identical to the
   *  registered one — otherwise the compiler refuses it (see compileSpec). */
  custom?: string[];
}

export interface LayoutSpec {
  /** Stage-column step in x (default 320). Must fit the manager gutter:
   *  step_x ≥ GRID_MIN_STEP_X (290 = node 200 + gap 90). */
  step_x?: number;
  /** Row step in y (default 170). */
  step_y?: number;
  /** Zone padding on the right and bottom when a zone is auto-sized
   *  (default 40). */
  pad?: number;
}

export interface NodeSpec {
  id: string;
  role: string;
  /** Explicit position [x, y] — the override. Exactly one of `at` or
   *  (`lane` + `row`) is required; never both. */
  at?: [number, number];
  /** Grid column (Phase 2): 0 = the manager gutter, ≥ 1 = stage columns
   *  at step_x × lane. Relative to the node's parent zone, or to the
   *  canvas for a top-level node. Requires `row`. */
  lane?: number;
  /** Grid row (Phase 2): y = step_y × row — or the string `after-lines`
   *  (Phase 3): the first row after the line block, i.e. count + 1 +
   *  row_offset (0 when the lines block sets no offset).
   *  Requires `lane` and a `lines:` block. */
  row?: number | 'after-lines';
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
  /** Zone size [width, height] → style + zIndex -1. Zones only. Optional
   *  since Phase 2: when omitted, the engine sizes the zone from its
   *  children (max child edge + layout pad); when present it overrides. */
  size?: [number, number];
  /** Appended to data.zone. Zones only. */
  department_id?: string;
  /** Id of the enclosing zone node → parentId + extent 'parent'. */
  parent?: string;
}

/**
 * Edge expansion. A single string on each side is one edge. A list on ONE
 * side fans out (one edge per entry, in listed order). Lists on BOTH sides
 * zip pairwise and must have equal length — e.g. three drafters to their
 * three creator profiles in one line.
 *
 * Phase 3: an endpoint containing `{n}` expands to every line's instance
 * of that template node (the endpoint must exactly equal a template node
 * id). A run of consecutive `{n}` endpoints in one list expands
 * line-major: for line 1 the run's entries, then line 2, and so on — so
 * `[content_selector_{n}, creator_{n}, drf_{n}]` becomes
 * `content_selector_1, creator_1, drf_1, content_selector_2, …`.
 *
 * Phase 6 — bulk dispatch (`dispatch`, INSTEAD of `to`): one or both rules
 * that expand to TASK_DISPATCH_RESULT edges at build time, so a manager's
 * whole fan-out is two rule names instead of a hand-listed target list.
 * `from` must be a single node id (the manager); `kind` must be
 * TASK_DISPATCH_RESULT. The rules:
 * - `department` — every employee node in the same parent zone as `from`
 *   (the manager's department), excluding `from` itself, in file order.
 *   Non-employee zone children (e.g. an L2 profile node) are not targets.
 * - `line` — every employee instance of the line template, in template
 *   order, line-major (line 1's instances, then line 2's, …). Non-employee
 *   template nodes (e.g. `creator_profile_{n}`, `income_register_{n}` —
 *   role l2) are not targets.
 * Several rules in one entry union their targets (deduplicated) and the
 * union is ordered by the file order of the target nodes — so
 * `dispatch: [department, line]` on v3 reproduces the hand-listed fan-out
 * exactly (plain staff, then line instances, then shared operations),
 * instead of grouping targets by rule.
 */
export interface EdgeSpec {
  from: string | string[];
  to?: string | string[];
  /** Phase 6: bulk-dispatch rule(s) — `department` and/or `line`. Present
   *  only instead of `to`; `kind` must then be TASK_DISPATCH_RESULT. */
  dispatch?: string | string[];
  kind: CableKind;
  /** MEMORY_BUS only; defaults to 'read' (the mkEdge rule). */
  access?: 'read' | 'write';
}

/**
 * One entry of a line template (Phase 3). Same fields as NodeSpec, except:
 * - `id` MUST contain `{n}` (the line index, 1-based) — it is what makes
 *   each instance distinct. `label`, `name` and `employee_id` MAY contain
 *   `{n}`; `parent` and `prefix` must not.
 * - `row` may be the string `'{n}'` — the instance's row IS its line
 *   number, plus the block's `row_offset` when set (write it quoted in
 *   YAML: `row: "{n}"`).
 * - `step` (with `at:` only) shifts each later instance: instance k sits
 *   at `at + (k − 1) × step`. The v3 income registers use it
 *   (`at: [2760, 680]`, `step: [0, 170]`).
 * - `employee_id`, when omitted for an employee role, is derived by the
 *   compiler as `<prefix>.<role>_<n>.v1` — never write it by hand for
 *   instances. Non-employee roles (e.g. l2) take no employee_id.
 * - `size` / `department_id` are the zone-only fields, as in NodeSpec.
 */
export interface LineNodeSpec {
  id: string;
  role: string;
  at?: [number, number];
  step?: [number, number];
  lane?: number;
  row?: number | '{n}';
  label?: string;
  status?: ImplementationStatus;
  prefix?: string;
  employee_id?: string;
  name?: string;
  size?: [number, number];
  department_id?: string;
  parent?: string;
}

/**
 * An anchor in the `nodes:` list (Phase 3): where a slice of the line
 * template is instantiated, in file order. `true` expands every template
 * node not yet claimed by an earlier anchor, in template order; a list
 * expands exactly those template ids, in listed order. Every template
 * node must be claimed by exactly one anchor — the compiler refuses
 * unclaimed and doubly-claimed template nodes.
 */
export interface LinesAnchor {
  lines: true | string[];
}

/** One line template + its count (Phase 3). */
export interface LinesSpec {
  /** Number of lines (≥ 1). The v3 portfolio uses 3. */
  count: number;
  /** Rows the whole line block shifts down (V4, default 0): template
   *  `row: "{n}"` becomes n + row_offset, and a plain node's
   *  `row: after-lines` becomes count + 1 + row_offset. Lets a header
   *  row (e.g. team managers) sit above the lines. Must be ≥ 0. */
  row_offset?: number;
  nodes: LineNodeSpec[];
}

export interface TopologySpec {
  project: ProjectSpec;
  defaults?: DefaultsSpec;
  roles?: RolesSpec;
  /** If omitted, all three slots resolve to their presets. The emitted
   *  configs object is always in canonical v2 order (model_routing,
   *  sources_watchlist, pricing_config), whatever order the YAML lists. */
  configs?: Record<string, string>;
  /** Grid parameters for `lane`/`row` nodes. If omitted, the engine
   *  defaults (320/170/40) apply. */
  layout?: LayoutSpec;
  /** Line template + count (Phase 3). When present, `nodes` must contain
   *  anchors claiming every template node exactly once. */
  lines?: LinesSpec;
  /** Nodes in file order, or lines anchors. The compiler keeps document
   *  order; an anchor expands in place, line by line. */
  nodes: Array<NodeSpec | LinesAnchor>;
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
