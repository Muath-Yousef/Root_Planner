import { describe, expect, it } from 'vitest';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { compileTopology, DslError } from '../src/dsl/compiler';
import { checkCable } from '../src/engine/cablingValidator';
import { collectProblems, errorCount } from '../src/engine/problems';
import { parseProjectText, serializeProject } from '../src/persistence/projectIO';
import { buildPortfolioProject, buildPortfolioSpec, PORTFOLIO_DEFAULT_LINES } from '../src/presets/portfolio';
import type { ProjectFile } from '../src/types';
import influencerRoleDefs from '../examples/influencer_roles';

/**
 * Phase 3 — the multi-instance abstraction (`lines:`) and the parameterized
 * portfolio preset. Judged by the plan's acceptance: changing `lines`
 * regenerates a valid portfolio (node/edge counts scale, 0 errors,
 * employee_ids unique), and the v3 hash is preserved at N = 3 — both from
 * the YAML example and from the preset.
 */

const YAML_PATH = path.join(process.cwd(), 'examples', 'influencers_system_v3.yaml');
const JSON_PATH = path.join(process.cwd(), 'examples', 'influencers_system_v3.socroot.json');
/** Governing hash of the delivered v3 file (7 Nov 2026, deterministic build). */
const EXPECTED_SHA256 = 'ac9f04781e22f0de54a0ebc04a00133ee861c6525274c48aeb26bd2be0256ed1';
const V3_ID = 'proj-influencers-system-v3';
const V3_NOW = '2026-11-07T06:19:00.000Z';
const yaml = fs.readFileSync(YAML_PATH, 'utf-8');

/** Base (non-line) nodes/edges of the portfolio: 24 nodes, 31 edges. Each line adds 5 nodes and 12 edges. */
const BASE_NODES = 24, BASE_EDGES = 31, NODES_PER_LINE = 5, EDGES_PER_LINE = 12;

const employeeIds = (project: ProjectFile): string[] =>
  project.nodes
    .map((n) => (n.data.employee?.contract as { employee_id?: string } | undefined)?.employee_id)
    .filter((x): x is string => typeof x === 'string');

/** The studio's own validation as judge: parse + every cable + 0 errors. */
function assertValid(project: ProjectFile): void {
  const parsed = parseProjectText(serializeProject(project));
  expect(parsed.ok).toBe(true);
  const byId = (id: string) => project.nodes.find((n) => n.id === id)!;
  for (const e of project.edges) {
    const r = checkCable(byId(e.source), byId(e.target), e.data!.kind, e.data!.access);
    expect(r.verdict.ok, `${e.id}: ${r.verdict.ok ? '' : r.verdict.reason}`).toBe(true);
  }
  const problems = collectProblems(project.nodes, project.edges, { tenant_id: 'socroot-core' });
  expect(errorCount(problems)).toBe(0);
}

describe('portfolio preset — line counts 1..5', () => {
  it.each([1, 2, 3, 4, 5])('N=%i compiles, validates with 0 errors, and scales (nodes 24+5N, edges 31+12N)', (n) => {
    const project = buildPortfolioProject({ lines: n, id: 'proj-test-portfolio', now: V3_NOW });
    expect(project.nodes).toHaveLength(BASE_NODES + NODES_PER_LINE * n);
    expect(project.edges).toHaveLength(BASE_EDGES + EDGES_PER_LINE * n);
    assertValid(project);
    // One ORG-003 warning per node in the planned department (manager + 11 + 3N employees).
    const problems = collectProblems(project.nodes, project.edges, { tenant_id: 'socroot-core' });
    expect(problems.filter((p) => p.severity === 'warning')).toHaveLength(12 + 3 * n);
  });

  it.each([1, 2, 3, 4, 5])('N=%i: every employee_id is unique and every line instance is inf.<role>_<n>.v1', (n) => {
    const project = buildPortfolioProject({ lines: n, id: 'proj-test-portfolio', now: V3_NOW });
    const ids = employeeIds(project);
    expect(new Set(ids).size).toBe(ids.length);
    for (let line = 1; line <= n; line++) {
      const contract = (id: string) => project.nodes.find((x) => x.id === id)!.data.employee!.contract as { employee_id: string };
      expect(contract(`content_selector_${line}`).employee_id).toBe(`inf.content_selector_${line}.v1`);
      expect(contract(`creator_${line}`).employee_id).toBe(`inf.creator_${line}.v1`);
      expect(contract(`drf_${line}`).employee_id).toBe(`inf.drafter_${line}.v1`);
    }
    // No hand-written employee_id survives anywhere in the preset spec.
    expect(JSON.stringify(buildPortfolioSpec({ lines: n }))).not.toContain('inf.content_selector_');
    expect(JSON.stringify(buildPortfolioSpec({ lines: n }))).not.toContain('inf.creator_');
    expect(JSON.stringify(buildPortfolioSpec({ lines: n }))).not.toContain('inf.drafter_');
  });

  it.each([1, 2, 3, 4, 5])('N=%i: the kill switch reaches every creator, and the per-line edges follow the lines', (n) => {
    const project = buildPortfolioProject({ lines: n, id: 'proj-test-portfolio', now: V3_NOW });
    const has = (s: string, t: string, kind: string) =>
      project.edges.some((e) => e.source === s && e.target === t && e.data!.kind === kind);
    for (let line = 1; line <= n; line++) {
      expect(has('kill', `creator_${line}`, 'KILL_PLANE_SIGNAL')).toBe(true);
      expect(has('transformer', `income_register_${line}`, 'MEMORY_BUS')).toBe(true);
      expect(has('str', `creator_profile_${line}`, 'MEMORY_BUS')).toBe(true);
      expect(has(`drf_${line}`, `creator_profile_${line}`, 'MEMORY_BUS')).toBe(true);
      expect(has('mgr', `content_selector_${line}`, 'TASK_DISPATCH_RESULT')).toBe(true);
    }
  });

  it.each([1, 2, 3, 4, 5])('N=%i: the shared-operations row sits right below the last line and the zone grows with it', (n) => {
    const project = buildPortfolioProject({ lines: n, id: 'proj-test-portfolio', now: V3_NOW });
    const byId = (id: string) => project.nodes.find((x) => x.id === id)!;
    // Ops row = count + 1 → y = 170 × (N + 1); zone height = 170N + 274.
    expect(byId('publisher').position.y).toBe(170 * (n + 1));
    expect(byId('zone_dept').style!.height).toBe(170 * n + 274);
    expect(byId('zone_dept').style!.width).toBe(2160);
    // The right column's tail and the kill switch shift one pitch per line beyond 3.
    expect(byId('pe').position.y).toBe(1190 + 170 * (n - 3));
    expect(byId('bg').position.y).toBe(1360 + 170 * (n - 3));
    expect(byId('kill').position.y).toBe(950 + 170 * (n - 3));
  });

  it('changing the count regenerates the file (N=3 vs N=4 differ, both valid)', () => {
    const three = serializeProject(buildPortfolioProject({ lines: 3, id: 'proj-test-portfolio', now: V3_NOW }));
    const four = serializeProject(buildPortfolioProject({ lines: 4, id: 'proj-test-portfolio', now: V3_NOW }));
    expect(four).not.toBe(three);
    expect(crypto.createHash('sha256').update(four).digest('hex')).not.toBe(EXPECTED_SHA256);
  });

  it('at N=3 the preset reproduces the delivered v3 file, byte-identical', () => {
    const project = buildPortfolioProject({ lines: 3, id: V3_ID, name: 'منظومة المؤثرين (v3)', now: V3_NOW });
    const text = `${serializeProject(project)}\n`;
    expect(text).toBe(fs.readFileSync(JSON_PATH, 'utf-8'));
    expect(crypto.createHash('sha256').update(text).digest('hex')).toBe(EXPECTED_SHA256);
  });

  it('defaults to 3 lines', () => {
    expect(PORTFOLIO_DEFAULT_LINES).toBe(3);
    const project = buildPortfolioProject({ id: 'proj-test-portfolio', now: V3_NOW });
    expect(project.nodes).toHaveLength(BASE_NODES + NODES_PER_LINE * 3);
    expect(project.edges).toHaveLength(BASE_EDGES + EDGES_PER_LINE * 3);
  });

  it('refuses a non-positive or non-integer line count', () => {
    expect(() => buildPortfolioProject({ lines: 0 })).toThrowError(/≥ 1/);
    expect(() => buildPortfolioProject({ lines: 2.5 })).toThrowError(/≥ 1/);
  });
});

describe('v3 YAML — the lines abstraction in the example', () => {
  it.each([1, 2])('count=%i in the YAML regenerates a valid portfolio (nodes 24+5N, edges 31+12N)', (n) => {
    const src = yaml.replace('  count: 3', `  count: ${n}`);
    const project = compileTopology(src, { customRoles: influencerRoleDefs });
    expect(project.nodes).toHaveLength(BASE_NODES + NODES_PER_LINE * n);
    expect(project.edges).toHaveLength(BASE_EDGES + EDGES_PER_LINE * n);
    assertValid(project);
  });

  it('count=4 in the YAML is refused: the manual right column (pe) collides with the 4th register', () => {
    const src = yaml.replace('  count: 3', '  count: 4');
    let caught: DslError | undefined;
    try {
      compileTopology(src, { customRoles: influencerRoleDefs });
    } catch (e) {
      caught = e as DslError;
    }
    expect(caught).toBeInstanceOf(DslError);
    // The top-level column is manual (docs/LAYOUT.md): pe sits at the
    // authored position, so the 4th register lands on top of it. The
    // preset (which shifts pe/bg/kill) is the parameterized path past 3.
    expect(caught!.message).toMatch(/income_register_4/);
    expect(caught!.message).toMatch(/تتداخلان/);
  });
});

describe('lines abstraction — minimal spec (anchor `lines: true`)', () => {
  // A drafter reading its own line's profile (the v3 drf→creator_profile
  // zip, shrunk): the manager dispatches to each writer, and each writer
  // reads only its own profile — the zip must not cross lines.
  const mini = `project:
  id: proj-mini
  name: مصغر
  tenant: socroot-core
  horizon: TRANSITIONAL
lines:
  count: 2
  nodes:
    - id: writer_{n}
      role: drafter
      lane: 1
      row: "{n}"
      label: "كاتب {n}"
      status: PLANNED
    - id: profile_{n}
      role: l2
      lane: 2
      row: "{n}"
      label: "ملف {n}"
      status: PLANNED
nodes:
  - { id: mgr, role: manager, at: [0, 0], label: المدير, status: PLANNED }
  - { lines: true }
edges:
  - { from: mgr, to: "writer_{n}", kind: TASK_DISPATCH_RESULT }
  - { from: "writer_{n}", to: "profile_{n}", kind: MEMORY_BUS, access: read }
`;

  it('expands one anchor to every line, with auto employee_ids and a zip edge', () => {
    const project = compileTopology(mini);
    expect(project.nodes).toHaveLength(5);
    expect(project.edges).toHaveLength(4);
    assertValid(project);
    const ids = employeeIds(project);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    expect(ids).toContain('inf.manager.v1');
    expect(ids).toContain('inf.drafter_1.v1');
    expect(ids).toContain('inf.drafter_2.v1');
    const pairs = project.edges.map((e) => `${e.source}->${e.target}`);
    expect(pairs).toContain('writer_1->profile_1');
    expect(pairs).toContain('writer_2->profile_2');
    expect(pairs).not.toContain('writer_1->profile_2');
  });
});

describe('lines abstraction — errors name the problem', () => {
  const head = `project:
  id: proj-test
  name: اختبار
  tenant: socroot-core
  horizon: TRANSITIONAL
`;
  const template = (nodes: string) => `${head}lines:
  count: 2
  nodes:
${nodes}nodes:
  - { id: founder, role: founder, at: [0, 0], label: المؤسس }
  - { lines: true }
edges: []
`;
  const worker = `    - id: worker_{n}
      role: scout
      lane: 1
      row: "{n}"
      label: "عامل {n}"
`;

  it('count 0 is refused', () => {
    const src = template(worker).replace('count: 2', 'count: 0');
    expect(() => compileTopology(src)).toThrowError(/≥ 1/);
  });

  it('a template id without {n} is refused', () => {
    const src = template(worker.replace('worker_{n}', 'worker'));
    expect(() => compileTopology(src)).toThrowError(/\{n\}/);
  });

  it('an anchor claiming an unknown template id is refused', () => {
    const src = template(worker).replace('{ lines: true }', '{ lines: ["ghost_{n}"] }');
    expect(() => compileTopology(src)).toThrowError(/غير موجودة/);
  });

  it('an unclaimed template node is refused', () => {
    const checker = `    - id: checker_{n}
      role: evaluator
      lane: 2
      row: "{n}"
      label: "مدقق {n}"
`;
    const src = template(worker + checker).replace(
      '{ lines: true }',
      '{ lines: ["worker_{n}"] }',
    );
    expect(() => compileTopology(src)).toThrowError(/بلا مرساة/);
  });

  it('a template node claimed by two anchors is refused', () => {
    const src = template(worker).replace(
      '  - { lines: true }',
      '  - { lines: ["worker_{n}"] }\n  - { lines: ["worker_{n}"] }',
    );
    expect(() => compileTopology(src)).toThrowError(/مرساتين/);
  });

  it('{n} in a plain node id is refused', () => {
    const src = `${head}nodes:
  - { id: "foo_{n}", role: founder, at: [0, 0], label: س }
edges: []
`;
    expect(() => compileTopology(src)).toThrowError(/محجوز/);
  });

  it('a {n} edge endpoint that matches no template node is refused', () => {
    const src = template(worker).replace(
      'edges: []',
      'edges:\n  - { from: founder, to: "ghost_{n}", kind: OBJECTIVE_ROUTE }',
    );
    expect(() => compileTopology(src)).toThrowError(/لا يطابق/);
  });

  it('step without at is refused', () => {
    const reg = `    - id: reg_{n}
      role: l2
      step: [0, 170]
      label: "سجل {n}"
`;
    const src = template(worker + reg).replace(
      '{ lines: true }',
      '{ lines: ["worker_{n}", "reg_{n}"] }',
    );
    expect(() => compileTopology(src)).toThrowError(/يتطلب at/);
  });

  it('row after-lines without a lines block is refused', () => {
    const src = `${head}nodes:
  - { id: publisher, role: integration_spec, lane: 3, row: after-lines, label: الناشر }
edges: []
`;
    expect(() => compileTopology(src)).toThrowError(/يتطلب قسم lines/);
  });

  it('an anchor without a lines block is refused', () => {
    const src = `${head}nodes:
  - { id: founder, role: founder, at: [0, 0], label: المؤسس }
  - { lines: true }
edges: []
`;
    expect(() => compileTopology(src)).toThrowError(/بلا قسم lines/);
  });
});
