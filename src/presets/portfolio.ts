import { compileSpec, DslError } from '../dsl/compiler';
import type { LinesAnchor, LinesSpec, NodeSpec, TopologySpec } from '../dsl/schema';
import type { RoleDefinition } from '../registry';
import type { ProjectFile } from '../types';
import influencerRoleDefs from '../registry/roles/influencer';

/**
 * The parameterized influencer portfolio (Phase 3): the v3 topology as a
 * preset the studio can offer — one shared platform + N influencer lines
 * + shared operations — built on the same DSL compiler (compileSpec), not
 * on the factory directly. A user starts a new multi-influencer portfolio
 * from `buildPortfolioProject({ lines })` instead of from the YAML file.
 *
 * The preset's spec is the same shape as `examples/influencers_system_v3.yaml`
 * (same line template, same anchors, same `{n}` edges) — the test suite
 * pins it: at lines = 3, with the v3 id and build time, it serializes
 * byte-identically to the delivered v3 file. The two copies cannot drift
 * silently.
 *
 * The one place the preset goes further than the YAML: the explicit
 * top-level positions (pe / bg / kill) are correct for the authored count
 * (3 lines) and shift by one grid pitch (170) per line beyond it — the
 * YAML keeps the authored positions, because the top-level composition is
 * manual by design (see docs/LAYOUT.md: a real flow model for it needs a
 * plan decision, out of Phase 3 scope). The shared-operations row needs
 * no arithmetic: it uses the DSL's own `row: 'after-lines'`.
 */

export const PORTFOLIO_DEFAULT_LINES = 3;
/** The count the explicit top-level positions were authored for (v3). */
const AUTHORED_LINES = 3;
/** The grid pitch (layout.step_y): one pitch per line beyond the authored count. */
const PITCH_Y = 170;

export interface PortfolioOptions {
  /** Number of influencer lines (default 3). Must be an integer ≥ 1. */
  lines?: number;
  /** Project id. Defaults to a generated id, like the wizard's. */
  id?: string;
  /** Project name. Defaults to 'منظومة المؤثرين'. */
  name?: string;
  /** Tenant id. Defaults to 'socroot-core'. */
  tenant?: string;
  /** Build time. Defaults to the current time (non-deterministic); pass a
   *  fixed value for a reproducible build. */
  now?: string;
  /** Custom role definitions. Defaults to the influencer roles (the same
   *  definitions the YAML example references); Phase 4 registers them in
   *  the studio, until then they live in examples/. */
  customRoles?: RoleDefinition[];
}

const generatedId = () => `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** The v3 line template: one production cell per line + its income register. */
const lineTemplate: LinesSpec = {
  count: PORTFOLIO_DEFAULT_LINES,
  nodes: [
    { id: 'content_selector_{n}', role: 'content_selector', lane: 3, row: '{n}', label: 'مختار المحتوى {n}', name: 'Content Selector {n}', parent: 'zone_dept' },
    { id: 'creator_{n}', role: 'creator', lane: 4, row: '{n}', label: 'صانع المحتوى {n}', name: 'Creator {n}', parent: 'zone_dept' },
    { id: 'drf_{n}', role: 'drafter', lane: 5, row: '{n}', label: 'الصائغ {n}', status: 'PLANNED', name: 'Drafter {n}', parent: 'zone_dept' },
    { id: 'creator_profile_{n}', role: 'l2', lane: 6, row: '{n}', label: 'L2 — ملف صانع المحتوى {n}', status: 'PLANNED', parent: 'zone_dept' },
    { id: 'income_register_{n}', role: 'l2', at: [2760, 680], step: [0, 170], label: 'L2 — سجل مصادر الدخل {n}', status: 'PLANNED' },
  ],
};

/** The shared-operations row, one row after the last line (DSL keyword). */
const opsRow = (id: string, role: string, lane: number, label: string): NodeSpec => ({
  id, role, lane, row: 'after-lines', label, parent: 'zone_dept',
});

/**
 * Builds the portfolio spec for `lines` influencer lines. The spec is a
 * plain TopologySpec — the compiler (compileSpec) does the instantiation,
 * so this function holds no factory or layout logic of its own.
 */
export function buildPortfolioSpec(options: PortfolioOptions = {}): TopologySpec {
  const lines = options.lines ?? PORTFOLIO_DEFAULT_LINES;
  if (!Number.isInteger(lines) || lines < 1) {
    throw new DslError(`عدد الخطوط "${lines}" غير صالح — يجب أن يكون عدداً صحيحاً ≥ 1`, { field: 'lines' });
  }
  // The explicit top-level positions were authored for 3 lines; each line
  // beyond that pushes the right column's tail and the kill switch down by
  // one pitch, keeping the authored gaps (pe one pitch below the last
  // register, bg one pitch below pe, kill 206 below the department zone).
  const shift = (lines - AUTHORED_LINES) * PITCH_Y;
  const cellAnchor: LinesAnchor = { lines: ['content_selector_{n}', 'creator_{n}', 'drf_{n}', 'creator_profile_{n}'] };
  const registerAnchor: LinesAnchor = { lines: ['income_register_{n}'] };
  return {
    project: {
      id: options.id ?? generatedId(),
      name: options.name ?? 'منظومة المؤثرين',
      tenant: options.tenant ?? 'socroot-core',
      tenant_name: 'Sovereign Core',
      isolation: 'logical_rls',
      horizon: 'TRANSITIONAL',
      ...(options.now !== undefined ? { created_at: options.now } : {}),
    },
    defaults: { department: 'dept_influencer_system', manager: 'inf.manager.v1', prefix: 'inf' },
    roles: { source: 'src/registry/roles/influencer.ts', custom: ['collector', 'content_selector', 'creator'] },
    configs: { model_routing: 'preset', sources_watchlist: 'preset', pricing_config: 'preset' },
    layout: { step_x: 320, step_y: 170, pad: 40 },
    lines: { count: lines, nodes: lineTemplate.nodes },
    nodes: [
      { id: 'founder', role: 'founder', at: [0, 300], label: 'المؤسس' },
      { id: 'orch', role: 'orchestrator', at: [230, 300], label: 'المنسق', status: 'PLANNED', prefix: 'core' },
      { id: 'zone_dept', role: 'zone_line', at: [470, -40], label: 'dept_influencer_system', status: 'PLANNED', department_id: 'dept_influencer_system' },
      { id: 'mgr', role: 'manager', lane: 0, row: 2, label: 'مدير قطاع المؤثرين', status: 'PLANNED', parent: 'zone_dept' },
      { id: 'scout', role: 'scout', lane: 1, row: 0, label: 'المستطلع', status: 'PLANNED', parent: 'zone_dept' },
      { id: 'collector', role: 'collector', lane: 1, row: 1, label: 'جامع بيانات المؤثرين', parent: 'zone_dept' },
      { id: 'transformer', role: 'systems_engineer', lane: 1, row: 2, label: 'مهندس تحويل البيانات', parent: 'zone_dept' },
      { id: 'ctx', role: 'context', lane: 2, row: 0, label: 'السياق', status: 'PLANNED', parent: 'zone_dept' },
      { id: 'custodian', role: 'knowledge_custodian', lane: 2, row: 1, label: 'أمين قاعدة البيانات', parent: 'zone_dept' },
      { id: 'eva', role: 'evaluator', lane: 2, row: 2, label: 'المقيّم', status: 'PLANNED', parent: 'zone_dept' },
      { id: 'str', role: 'strategist', lane: 3, row: 0, label: 'الاستراتيجي', status: 'PLANNED', parent: 'zone_dept' },
      cellAnchor,
      opsRow('publisher', 'integration_spec', 3, 'الناشر'),
      opsRow('compliance', 'compliance', 4, 'مراجع الامتثال والإفصاح'),
      opsRow('income_mgr', 'financial_controller', 5, 'مدير مصادر الدخل'),
      opsRow('perf_analyst', 'performance_analyst', 6, 'محلل الأداء والدخل'),
      { id: 'ssrf', role: 'ssrf_guard', at: [2760, 0], label: 'حارس SSRF ووكيل الخروج' },
      { id: 'l1', role: 'l1', at: [2760, 170], label: 'L1 — البيانات الخام', status: 'PLANNED' },
      { id: 'l2', role: 'l2', at: [2760, 340], label: 'L2 — قاعدة بيانات المؤثرين' },
      { id: 'l3', role: 'l3', at: [2760, 510], label: 'L3 — الذاكرة الدلالية', status: 'PLANNED' },
      registerAnchor,
      { id: 'pe', role: 'policy_engine', at: [2760, 1190 + shift], label: 'محرك السياسات' },
      { id: 'bg', role: 'budget_guard', at: [2760, 1360 + shift], label: 'حارس الميزانية' },
      { id: 'zone_web', role: 'zone_untrusted', at: [3020, -30], size: [260, 200], label: 'العالم غير الموثوق' },
      { id: 'web', role: 'external', at: [40, 70], label: 'Instagram', status: 'PLANNED', parent: 'zone_web' },
      { id: 'kill', role: 'kill_switch', at: [470, 950 + shift], label: 'قاطع الطوارئ' },
    ],
    edges: [
      { from: 'founder', to: 'orch', kind: 'OBJECTIVE_ROUTE' },
      { from: 'orch', to: 'mgr', kind: 'OBJECTIVE_ROUTE' },
      { from: 'mgr', dispatch: ['department', 'line'], kind: 'TASK_DISPATCH_RESULT' },
      { from: 'mgr', to: 'founder', kind: 'ESCALATION_PATH' },
      { from: 'scout', to: 'ssrf', kind: 'EGRESS_NETWORK' },
      { from: 'ssrf', to: 'web', kind: 'EGRESS_NETWORK' },
      { from: 'publisher', to: 'ssrf', kind: 'EGRESS_NETWORK' },
      { from: 'scout', to: 'l1', kind: 'MEMORY_BUS', access: 'write' },
      { from: 'collector', to: 'l1', kind: 'MEMORY_BUS', access: 'write' },
      { from: 'transformer', to: 'l1', kind: 'MEMORY_BUS', access: 'read' },
      { from: 'transformer', to: 'l2', kind: 'MEMORY_BUS', access: 'write' },
      { from: 'transformer', to: 'income_register_{n}', kind: 'MEMORY_BUS', access: 'write' },
      { from: 'custodian', to: 'l2', kind: 'MEMORY_BUS', access: 'read' },
      { from: 'custodian', to: 'l3', kind: 'MEMORY_BUS', access: 'write' },
      { from: 'str', to: 'creator_profile_{n}', kind: 'MEMORY_BUS', access: 'write' },
      { from: 'drf_{n}', to: 'creator_profile_{n}', kind: 'MEMORY_BUS', access: 'read' },
      { from: 'eva', to: 'creator_profile_{n}', kind: 'MEMORY_BUS', access: 'read' },
      { from: 'compliance', to: 'creator_profile_{n}', kind: 'MEMORY_BUS', access: 'read' },
      { from: 'perf_analyst', to: 'creator_profile_{n}', kind: 'MEMORY_BUS', access: 'read' },
      { from: 'eva', to: 'l2', kind: 'MEMORY_BUS', access: 'read' },
      { from: 'compliance', to: 'l2', kind: 'MEMORY_BUS', access: 'read' },
      { from: 'income_mgr', to: 'income_register_{n}', kind: 'MEMORY_BUS', access: 'read' },
      { from: 'income_mgr', to: 'l2', kind: 'MEMORY_BUS', access: 'read' },
      { from: 'perf_analyst', to: 'income_register_{n}', kind: 'MEMORY_BUS', access: 'read' },
      { from: 'perf_analyst', to: 'l2', kind: 'MEMORY_BUS', access: 'read' },
      { from: 'ctx', to: 'l3', kind: 'MEMORY_BUS', access: 'read' },
      { from: 'str', to: 'l2', kind: 'MEMORY_BUS', access: 'read' },
      { from: 'kill', to: 'mgr', kind: 'KILL_PLANE_SIGNAL' },
      { from: 'kill', to: 'publisher', kind: 'KILL_PLANE_SIGNAL' },
      { from: 'kill', to: 'creator_{n}', kind: 'KILL_PLANE_SIGNAL' },
    ],
  };
}

/**
 * Builds a portfolio project file for `lines` influencer lines (default 3)
 * by compiling the preset spec with the DSL compiler. Pass a fixed `id`
 * and `now` for a reproducible build (the tests pin the v3 id and build
 * time at 3 lines); otherwise the id is generated and the time is now.
 */
export function buildPortfolioProject(options: PortfolioOptions = {}): ProjectFile {
  const spec = buildPortfolioSpec(options);
  return compileSpec(spec, {
    customRoles: options.customRoles ?? influencerRoleDefs,
    ...(options.now !== undefined ? { now: options.now } : {}),
  });
}
