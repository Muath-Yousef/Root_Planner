import { describe, expect, it } from 'vitest';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { compileTopology, DslError } from '../src/dsl/compiler';
import { checkCable } from '../src/engine/cablingValidator';
import { collectProblems, errorCount } from '../src/engine/problems';
import { parseProjectText, serializeProject } from '../src/persistence/projectIO';
import influencerRoleDefs from '../examples/influencer_roles';

/**
 * Phase 1 — the DSL compiler is judged by the v3 example: one YAML file must
 * compile to the delivered v3 file byte-identically (same hash the v3
 * generator test guards), and the output must pass the studio's own
 * validation (parseProjectText / checkCable / collectProblems). The compiler
 * invents no parallel validator; these tests run the studio's.
 */

const YAML_PATH = path.join(process.cwd(), 'examples', 'influencers_system_v3.yaml');
const JSON_PATH = path.join(process.cwd(), 'examples', 'influencers_system_v3.socroot.json');
/** Governing hash of the delivered v3 file (7 Nov 2026, deterministic build). */
const EXPECTED_SHA256 = 'ac9f04781e22f0de54a0ebc04a00133ee861c6525274c48aeb26bd2be0256ed1';
const yaml = fs.readFileSync(YAML_PATH, 'utf-8');
const compileV3 = () => compileTopology(yaml, { customRoles: influencerRoleDefs });

/** Minimal valid spec, for error-case tests. */
const minimal = (nodes: string, edges = '[]') => `project:
  id: proj-test
  name: اختبار
  tenant: socroot-core
  horizon: TRANSITIONAL
nodes:
${nodes}
edges: ${edges}
`;

describe('DSL compiler — v3 example (Phase 1)', () => {
  it('compiles the v3 YAML to the delivered v3 file, byte-identical', () => {
    const project = compileV3();
    expect(project.nodes).toHaveLength(39);
    expect(project.edges).toHaveLength(67);
    expect(project.id).toBe('proj-influencers-system-v3');
    const text = `${serializeProject(project)}\n`;
    expect(text).toBe(fs.readFileSync(JSON_PATH, 'utf-8'));
    expect(crypto.createHash('sha256').update(text).digest('hex')).toBe(EXPECTED_SHA256);
  });

  it('is deterministic: two compilations give the same bytes', () => {
    const a = serializeProject(compileV3());
    const b = serializeProject(compileV3());
    expect(a).toBe(b);
  });

  it('passes the studio validation as judge (0 errors, same 21 ORG-003 warnings)', () => {
    const project = compileV3();
    const parsed = parseProjectText(serializeProject(project));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.migrated_from).toBeNull();
    const byId = (id: string) => project.nodes.find((n) => n.id === id)!;
    for (const e of project.edges) {
      const r = checkCable(byId(e.source), byId(e.target), e.data!.kind, e.data!.access);
      expect(r.verdict.ok, `${e.id}: ${r.verdict.ok ? '' : r.verdict.reason}`).toBe(true);
    }
    const problems = collectProblems(project.nodes, project.edges, { tenant_id: 'socroot-core' });
    expect(errorCount(problems)).toBe(0);
    expect(problems.filter((p) => p.severity === 'warning')).toHaveLength(21);
  });

  it('honours the now option over the YAML created_at', () => {
    const project = compileTopology(yaml, { customRoles: influencerRoleDefs, now: '2030-01-01T00:00:00.000Z' });
    expect(project.created_at).toBe('2030-01-01T00:00:00.000Z');
    expect(project.updated_at).toBe('2030-01-01T00:00:00.000Z');
    // …and the only difference from the pinned build is the two timestamps.
    const pinned = serializeProject(compileV3());
    const shifted = serializeProject(project);
    expect(shifted.replaceAll('2030-01-01T00:00:00.000Z', '2026-11-07T06:19:00.000Z')).toBe(pinned);
  });

  it('uses factory defaults: registry label/status when omitted, presets when configs omitted', () => {
    const project = compileTopology(minimal('  - { id: founder, role: founder, at: [0, 0] }'));
    expect(project.nodes).toHaveLength(1);
    expect(project.nodes[0].data.label).toBe('Human Founder');
    expect(project.nodes[0].data.status).toBe('IMPLEMENTED');
    expect(project.configs.model_routing).toContain('model_routing.yaml');
    expect(project.configs.sources_watchlist).toContain('instagram.com');
    expect(project.configs.pricing_config).toContain('pricing_config.yaml');
  });
});

describe('DSL compiler — errors name the line and the field', () => {
  it('YAML syntax error reports its line', () => {
    let caught: DslError | undefined;
    try {
      compileTopology('project:\n  id: [unclosed\nnodes: []\nedges: []\n');
    } catch (e) {
      caught = e as DslError;
    }
    expect(caught).toBeInstanceOf(DslError);
    expect(typeof caught!.line).toBe('number');
    expect(caught!.message).toMatch(/YAML/);
  });

  it('unknown role names the role and its line', () => {
    const src = minimal('  - { id: x1, role: no_such_role, at: [0, 0], label: س }\n  - { id: founder, role: founder, at: [0, 0], label: المؤسس }');
    let caught: DslError | undefined;
    try {
      compileTopology(src);
    } catch (e) {
      caught = e as DslError;
    }
    expect(caught).toBeInstanceOf(DslError);
    expect(caught!.message).toMatch(/no_such_role/);
    expect(caught!.line).toBe(7);
    expect(caught!.field).toBe('nodes.x1.role');
  });

  it('custom role without a passed definition is refused (not silently registry-resolved)', () => {
    const src = minimal('  - { id: collector, role: collector, at: [0, 0], label: جامع البيانات }');
    expect(() => compileTopology(src)).toThrowError(/collector/);
    // With the definition passed, it compiles.
    const ok = compileTopology(`roles: { custom: [collector] }\n${src}`, { customRoles: influencerRoleDefs });
    expect(ok.nodes).toHaveLength(1);
    expect((ok.nodes[0].data.employee!.contract as { employee_id: string }).employee_id).toBe('inf.collector.v1');
  });

  it('unknown edge endpoint names the missing id', () => {
    const src = minimal(
      '  - { id: founder, role: founder, at: [0, 0], label: المؤسس }',
      '[{ from: founder, to: ghost, kind: OBJECTIVE_ROUTE }]',
    );
    expect(() => compileTopology(src)).toThrowError(/ghost/);
  });

  it('duplicate node id is refused', () => {
    const src = minimal('  - { id: founder, role: founder, at: [0, 0], label: المؤسس }\n  - { id: founder, role: founder, at: [10, 0], label: المؤسس }');
    expect(() => compileTopology(src)).toThrowError(/مكرر/);
  });

  it('unknown cable kind is refused', () => {
    const src = minimal(
      '  - { id: founder, role: founder, at: [0, 0], label: المؤسس }',
      '[{ from: founder, to: founder, kind: NOPE }]',
    );
    expect(() => compileTopology(src)).toThrowError(/NOPE/);
  });

  it('access on a non-MEMORY_BUS edge is refused', () => {
    const src = minimal(
      '  - { id: founder, role: founder, at: [0, 0], label: المؤسس }',
      '[{ from: founder, to: founder, kind: OBJECTIVE_ROUTE, access: write }]',
    );
    expect(() => compileTopology(src)).toThrowError(/MEMORY_BUS/);
  });

  it('mismatched zip lists are refused', () => {
    const src = minimal(
      '  - { id: a, role: founder, at: [0, 0], label: أ }\n  - { id: b, role: founder, at: [10, 0], label: ب }\n  - { id: c, role: founder, at: [20, 0], label: ج }',
      '[{ from: [a, b], to: [a, b, c], kind: OBJECTIVE_ROUTE }]',
    );
    expect(() => compileTopology(src)).toThrowError(/مختلفتا الطول/);
  });

  it('missing config slot is refused', () => {
    const src = `configs: { model_routing: preset }\n${minimal('  - { id: founder, role: founder, at: [0, 0], label: المؤسس }')}`;
    expect(() => compileTopology(src)).toThrowError(/sources_watchlist/);
  });

  it('a zone child must point at an existing zone', () => {
    const src = minimal('  - { id: founder, role: founder, at: [0, 0], label: المؤسس, parent: nowhere }');
    expect(() => compileTopology(src)).toThrowError(/nowhere/);
  });
});
