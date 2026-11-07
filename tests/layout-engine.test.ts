import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { load as loadYaml } from 'js-yaml';
import { compileTopology, DslError } from '../src/dsl/compiler';
import {
  DEFAULT_GRID_PARAMS, edgeEndpointOffsets, findOverlaps, gridCellPosition, zoneSizeFromChildren,
} from '../src/engine/layout';
import influencerRoleDefs from '../examples/influencer_roles';
import type { SEdge, SNode } from '../src/types';

/**
 * Phase 2 — the grid layout engine is judged against the delivered maps:
 * the v3 grid must reproduce the manual zone-child positions exactly, the
 * zone-size rule must reproduce the manual v3 zone size exactly (and the
 * v1/v2 deltas are recorded as documented exceptions, not hidden), the
 * endpoint spreading must match the picture renderer's `_spread` rule
 * offset for offset on the manager's 20-edge fan-out, and the compiled
 * v3 must still be byte-identical (that hash is guarded in
 * tests/dsl-compiler.test.ts and is NOT re-asserted here).
 */

const YAML_PATH = path.join(process.cwd(), 'examples', 'influencers_system_v3.yaml');
const yaml = fs.readFileSync(YAML_PATH, 'utf-8');
const yamlSpec = loadYaml(yaml) as { nodes: Array<Record<string, unknown>> };
const compileV3 = () => compileTopology(yaml, { customRoles: influencerRoleDefs });

/** Delivered JSON, the golden reference for positions and zone sizes. */
const jsonOf = (name: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'examples', name), 'utf-8')) as {
  nodes: Array<{ id: string; position: { x: number; y: number }; parentId?: string; style?: { width: number; height: number } }>;
};
const childrenOf = (file: string, zoneId: string) => jsonOf(file).nodes.filter((n) => n.parentId === zoneId);
const zoneOf = (file: string, zoneId: string) => jsonOf(file).nodes.find((n) => n.id === zoneId)!;

describe('layout engine — grid reproduces the v3 manual positions exactly', () => {
  it('every lane/row node in the v3 YAML lands on its delivered position', () => {
    const delivered = new Map(jsonOf('influencers_system_v3.socroot.json').nodes.map((n) => [n.id, n.position]));
    let checked = 0;
    for (const n of yamlSpec.nodes) {
      if (typeof n.lane !== 'number' || typeof n.row !== 'number') continue;
      expect(gridCellPosition(n.lane, n.row)).toEqual(delivered.get(n.id as string));
      checked++;
    }
    expect(checked).toBe(24);
  });

  it('the manager gutter is stepX − node width − GAP_X (320 − 200 − 90 = 30)', () => {
    expect(gridCellPosition(0, 2)).toEqual({ x: 30, y: 340 });
    expect(gridCellPosition(1, 0)).toEqual({ x: 320, y: 0 });
    expect(gridCellPosition(6, 4)).toEqual({ x: 1920, y: 680 });
    expect(gridCellPosition(3, 1, { stepX: 400, stepY: 200, pad: 40 })).toEqual({ x: 1200, y: 200 });
  });

  it('is deterministic and order-independent for zone sizing', () => {
    const kids = childrenOf('influencers_system_v3.socroot.json', 'zone_dept').map((n) => n.position);
    expect(zoneSizeFromChildren(kids)).toEqual(zoneSizeFromChildren([...kids].reverse()));
    expect(gridCellPosition(2, 3)).toEqual(gridCellPosition(2, 3));
  });
});

describe('layout engine — zone auto-sizing vs the three delivered maps', () => {
  it('reproduces the manual v3 department zone exactly (2160×784)', () => {
    const kids = childrenOf('influencers_system_v3.socroot.json', 'zone_dept').map((n) => n.position);
    expect(zoneSizeFromChildren(kids)).toEqual({ w: 2160, h: 784 });
    expect(zoneOf('influencers_system_v3.socroot.json', 'zone_dept').style).toEqual({ width: 2160, height: 784 });
  });

  it('v1: width exact, height 4 tighter than the rule (manual 560×640, rule 560×644)', () => {
    const kids = childrenOf('influencers_system.socroot.json', 'zone_dept').map((n) => n.position);
    expect(zoneSizeFromChildren(kids)).toEqual({ w: 560, h: 644 });
    // The delivered v1 zone is 560×640 — 4 units tighter at the bottom than
    // max-bottom + 40. No single rule derives 640 from these children, so
    // the v1 file keeps its manual size (its generator test guards it);
    // the rule is recorded here, not silently adjusted to fit.
    expect(zoneOf('influencers_system.socroot.json', 'zone_dept').style).toEqual({ width: 560, height: 640 });
  });

  it('v2: the manual zone carries slack the rule does not derive (manual 1620×520, rule 1520×509)', () => {
    const kids = childrenOf('influencers_system_v2.socroot.json', 'zone_dept').map((n) => n.position);
    expect(zoneSizeFromChildren(kids)).toEqual({ w: 1520, h: 509 });
    // The delivered v2 zone is 100 wider and 11 taller than max-edge + 40
    // — hand-picked slack (room for a further stage column). Same handling
    // as v1: the file keeps its manual size; the rule is recorded here.
    expect(zoneOf('influencers_system_v2.socroot.json', 'zone_dept').style).toEqual({ width: 1620, height: 520 });
  });

  it('zone_web is hand-sized in all three maps (child at an explicit offset, not the grid)', () => {
    for (const file of ['influencers_system.socroot.json', 'influencers_system_v2.socroot.json', 'influencers_system_v3.socroot.json']) {
      const kids = childrenOf(file, 'zone_web').map((n) => n.position);
      expect(kids).toEqual([{ x: 40, y: 70 }]);
      // Rule would give 280×174; the delivered size is 260×200 — which is
      // why zone_web keeps an explicit `size:` in the v3 YAML.
      expect(zoneSizeFromChildren(kids)).toEqual({ w: 280, h: 174 });
      expect(zoneOf(file, 'zone_web').style).toEqual({ width: 260, height: 200 });
    }
  });

  it('the compiled v3 zone is auto-sized (no explicit size in the YAML) and matches', () => {
    const project = compileV3();
    const zone = project.nodes.find((n) => n.id === 'zone_dept')!;
    expect(zone.style).toEqual({ width: 2160, height: 784 });
    expect(zone.zIndex).toBe(-1);
  });
});

describe('layout engine — the v3 YAML relies on the grid', () => {
  it('24 zone children use lane/row; only the 15 top-level nodes keep at:', () => {
    const withAt = yamlSpec.nodes.filter((n) => n.at !== undefined);
    const withCell = yamlSpec.nodes.filter((n) => typeof n.lane === 'number' && typeof n.row === 'number');
    expect(withCell).toHaveLength(24);
    expect(withAt).toHaveLength(15);
    expect(withAt.map((n) => n.id).sort()).toEqual(
      ['bg', 'founder', 'income_register_1', 'income_register_2', 'income_register_3', 'kill', 'l1', 'l2', 'l3', 'orch', 'pe', 'ssrf', 'zone_dept', 'zone_web', 'web'].sort(),
    );
  });

  it('zone_dept has no explicit size in the YAML (the engine sizes it)', () => {
    const zone = yamlSpec.nodes.find((n) => n.id === 'zone_dept')!;
    expect(zone.size).toBeUndefined();
    const webZone = yamlSpec.nodes.find((n) => n.id === 'zone_web')!;
    expect(webZone.size).toEqual([260, 200]);
  });
});

describe('layout engine — no overlaps', () => {
  it('the compiled v3 has zero overlapping pairs', () => {
    expect(findOverlaps(compileV3().nodes)).toEqual([]);
  });

  it('the compiler refuses two nodes in the same cell', () => {
    const src = `project: { id: proj-test, name: اختبار, tenant: socroot-core, horizon: TRANSITIONAL }
nodes:
  - { id: z1, role: zone_line, at: [0, 0], size: [1000, 1000], label: منطقة }
  - { id: a, role: founder, lane: 1, row: 0, label: أ, parent: z1 }
  - { id: b, role: founder, lane: 1, row: 0, label: ب, parent: z1 }
edges: []`;
    expect(() => compileTopology(src)).toThrowError(/الخلية نفسها/);
  });

  it('the compiler refuses two explicit nodes whose boxes overlap', () => {
    const src = `project: { id: proj-test, name: اختبار, tenant: socroot-core, horizon: TRANSITIONAL }
nodes:
  - { id: a, role: founder, at: [0, 0], label: أ }
  - { id: b, role: founder, at: [10, 0], label: ب }
edges: []`;
    expect(() => compileTopology(src)).toThrowError(/تتداخلان/);
  });

  it('findOverlaps skips a zone containing its own children', () => {
    const zone = { id: 'z', position: { x: 0, y: 0 }, style: { width: 500, height: 500 }, data: { kind: 'zone' } } as unknown as SNode;
    const kid = { id: 'k', position: { x: 10, y: 10 }, parentId: 'z', data: { kind: 'employee' } } as unknown as SNode;
    expect(findOverlaps([zone, kid])).toEqual([]);
  });
});

describe('layout engine — edge endpoint spreading (port of the renderer _spread)', () => {
  it('matches the renderer rule on the manager fan-out, offset for offset', () => {
    const project = compileV3();
    const offsets = edgeEndpointOffsets(project.nodes, project.edges);
    // The manager's out-group is ALL 21 edges from mgr (20 dispatch +
    // the escalation edge to founder — the renderer groups by source,
    // regardless of kind), ranked by target absolute y (zone y −40 +
    // relative y); offset = clamp((rank − 10) × 4, −26, 26). File order
    // of the fan-out list below.
    const expected: Record<string, number> = {
      scout: -26, collector: -26, transformer: -8, ctx: -26, custodian: -24,
      eva: -4, str: -26, content_selector_1: -20, creator_1: -16, drf_1: -12,
      content_selector_2: 0, creator_2: 4, drf_2: 8,
      content_selector_3: 16, creator_3: 20, drf_3: 24,
      publisher: 26, compliance: 26, income_mgr: 26, perf_analyst: 26,
    };
    const mgrEdges = project.edges
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.source === 'mgr' && e.data!.kind === 'TASK_DISPATCH_RESULT');
    expect(mgrEdges).toHaveLength(20);
    for (const { e, i } of mgrEdges) expect(offsets[i]!.out).toBe(expected[e.target]);
    // …and the 21st out-edge, the escalation to founder (target y 300,
    // rank 13), sits at +12 — proof the group really counts 21, not 20.
    const esc = project.edges.findIndex((e) => e.source === 'mgr' && e.data!.kind === 'ESCALATION_PATH');
    expect(esc).toBeGreaterThan(-1);
    expect(offsets[esc]!.out).toBe(12);
  });

  it('ranks a target in-edges by source y (l2 has seven MEMORY_BUS in-edges)', () => {
    const project = compileV3();
    const offsets = edgeEndpointOffsets(project.nodes, project.edges);
    // Sources by absolute y: str −40, custodian 130, transformer 300,
    // eva 300, compliance 640, income_mgr 640, perf_analyst 640.
    // Offsets (rank − 3) × 4 for n = 7.
    const expected: Record<string, number> = {
      str: -12, custodian: -8, transformer: -4, eva: 0, compliance: 4, income_mgr: 8, perf_analyst: 12,
    };
    const l2Edges = project.edges
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.target === 'l2' && e.data!.kind === 'MEMORY_BUS');
    expect(l2Edges).toHaveLength(7);
    for (const { e, i } of l2Edges) expect(offsets[i]!.in).toBe(expected[e.source]);
  });

  it('three edges spread −4 / 0 / +4, one edge stays 0, and the result is deterministic', () => {
    const node = (id: string, x: number, y: number): SNode =>
      ({ id, position: { x, y }, data: { kind: 'employee' } }) as unknown as SNode;
    const edge = (id: string, source: string, target: string): SEdge => ({ id, source, target }) as unknown as SEdge;
    const nodes = [node('s', 0, 0), node('t1', 100, 0), node('t2', 100, 100), node('t3', 100, 200)];
    const edges = [edge('e1', 's', 't1'), edge('e2', 's', 't2'), edge('e3', 's', 't3')];
    expect(edgeEndpointOffsets(nodes, edges)).toEqual([
      { out: -4, in: 0 }, { out: 0, in: 0 }, { out: 4, in: 0 },
    ]);
    expect(edgeEndpointOffsets(nodes, edges)).toEqual(edgeEndpointOffsets(nodes, edges));
    expect(edgeEndpointOffsets(nodes, [edges[0]!])).toEqual([{ out: 0, in: 0 }]);
  });
});

describe('layout engine — DSL placement rules', () => {
  const minimal = (nodes: string, extra = '') => `project:
  id: proj-test
  name: اختبار
  tenant: socroot-core
  horizon: TRANSITIONAL
${extra}nodes:
${nodes}
edges: []`;

  it('at: is honoured as an explicit override', () => {
    const project = compileTopology(minimal('  - { id: founder, role: founder, at: [123, 456], label: المؤسس }'));
    expect(project.nodes[0]!.position).toEqual({ x: 123, y: 456 });
  });

  it('a node with both at: and lane/row is refused', () => {
    expect(() => compileTopology(minimal('  - { id: a, role: founder, at: [0, 0], lane: 1, row: 0, label: أ }'))).toThrowError(/at وlane\/row معاً/);
  });

  it('lane without row is refused', () => {
    expect(() => compileTopology(minimal('  - { id: a, role: founder, lane: 1, label: أ }'))).toThrowError(/lane وrow معاً/);
  });

  it('a node with neither at: nor lane/row is refused', () => {
    expect(() => compileTopology(minimal('  - { id: a, role: founder, label: أ }'))).toThrowError(/بلا موضع/);
  });

  it('a zone with neither size nor children is refused', () => {
    expect(() => compileTopology(minimal('  - { id: z1, role: zone_line, at: [0, 0], label: منطقة }'))).toThrowError(/بلا size وبلا أبناء/);
  });

  it('a zone with an explicit size keeps it (override wins over the rule)', () => {
    const project = compileTopology(minimal(
      '  - { id: z1, role: zone_line, at: [0, 0], size: [100, 100], label: منطقة }\n  - { id: a, role: founder, at: [10, 10], label: أ, parent: z1 }',
    ));
    expect(project.nodes[0]!.style).toEqual({ width: 100, height: 100 });
  });

  it('step_x below the manager gutter minimum is refused', () => {
    const src = minimal('  - { id: founder, role: founder, at: [0, 0], label: المؤسس }', 'layout: { step_x: 100 }\n');
    expect(() => compileTopology(src)).toThrowError(/step_x=100/);
  });

  it('layout defaults are 320/170/40 (the v3 grid)', () => {
    expect(DEFAULT_GRID_PARAMS).toEqual({ stepX: 320, stepY: 170, pad: 40 });
    const project = compileTopology(minimal('  - { id: a, role: founder, lane: 1, row: 1, label: أ }'));
    expect(project.nodes[0]!.position).toEqual({ x: 320, y: 170 });
  });

  it('DslError is raised (not a bare engine error) for a bad grid', () => {
    let caught: DslError | undefined;
    try {
      compileTopology(minimal('  - { id: a, role: founder, lane: 1, label: أ }'));
    } catch (e) {
      caught = e as DslError;
    }
    expect(caught).toBeInstanceOf(DslError);
    expect(caught!.field).toBe('nodes[0].lane');
  });
});
