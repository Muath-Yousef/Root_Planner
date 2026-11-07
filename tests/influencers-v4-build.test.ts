import { describe, expect, it } from 'vitest';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { workloadOf } from '../src/cli/commands';
import { compileTopology } from '../src/dsl/compiler';
import { checkCable } from '../src/engine/cablingValidator';
import { findOverlaps } from '../src/engine/layout';
import { collectProblems, errorCount } from '../src/engine/problems';
import { parseProjectText, serializeProject } from '../src/persistence/projectIO';
import influencerRoleDefs from '../src/registry/roles/influencer';

/**
 * Influencer system topology v4 — DRAFT (7 Nov 2026). A team-manager
 * split of the ADOPTED v3 (39 nodes / 67 edges, hash ac9f0478…): the
 * department manager no longer dispatches to 20 employees directly, but
 * distributes work to 6 team managers, each dispatching to its own team
 * and escalating to the department manager. V3 is untouched and remains
 * the adopted target; this file is a draft to evaluate, built from
 * examples/influencers_system_v4.yaml (see docs/V4_DRAFT.md).
 *
 *   teams            acquisition (scout, collector, transformer),
 *                    context (ctx, custodian, eva, str),
 *                    one line manager per line (3 × selector/creator/drafter),
 *                    operations (publisher, compliance, income_mgr, perf_analyst)
 *   layout           a header row (row 0) of team managers above their
 *                    teams — lines.row_offset: 1 shifts the line block and
 *                    the after-lines row down one pitch; the zone grows to
 *                    2160×954; the right column below L3 and the kill
 *                    switch shift down one pitch too.
 *   safety           kill reaches each line manager (whole-cell halt), in
 *                    addition to the v3 targets (manager, publisher, creators).
 *   rules            the two-level hierarchy needs manager→manager dispatch
 *                    and escalation links (src/registry/cables.ts, V4) — the
 *                    studio's cable rules did not allow them before.
 *
 * Governing facts (judged by the studio's own validation):
 * 45 nodes / 82 edges, 0 errors, 1 brief ORG-003 warning (27 employees),
 * workload mgr 6/6 and each team manager 3–4, 28 unique employee contracts,
 * every memory store written by exactly one team (no data overlap).
 */

const YAML_PATH = path.join(process.cwd(), 'examples', 'influencers_system_v4.yaml');
const JSON_PATH = path.join(process.cwd(), 'examples', 'influencers_system_v4.socroot.json');
/** Hash of the V4 draft file (deterministic build, created_at 2026-11-07T12:45:00.000Z). */
const EXPECTED_SHA256 = '3d891c96216ae3a3ea0a408673eeb8a326dadd52975b7a40f468801abc553815';

const TEAM_MANAGERS = ['tm_acq', 'tm_ctx', 'tm_line_1', 'tm_line_2', 'tm_line_3', 'tm_ops'] as const;
const TEAM_OF: Record<string, string> = {
  tm_acq: 'acquisition', tm_ctx: 'context',
  tm_line_1: 'line_1', tm_line_2: 'line_2', tm_line_3: 'line_3', tm_ops: 'operations',
};
const TEAM_MEMBERS: Record<string, string[]> = {
  tm_acq: ['scout', 'collector', 'transformer'],
  tm_ctx: ['ctx', 'custodian', 'eva', 'str'],
  tm_line_1: ['content_selector_1', 'creator_1', 'drf_1'],
  tm_line_2: ['content_selector_2', 'creator_2', 'drf_2'],
  tm_line_3: ['content_selector_3', 'creator_3', 'drf_3'],
  tm_ops: ['publisher', 'compliance', 'income_mgr', 'perf_analyst'],
};
const TEAM_EMPLOYEE_IDS: Record<string, string> = {
  tm_acq: 'inf.manager_acquisition.v1',
  tm_ctx: 'inf.manager_context.v1',
  tm_line_1: 'inf.manager_line_1.v1',
  tm_line_2: 'inf.manager_line_2.v1',
  tm_line_3: 'inf.manager_line_3.v1',
  tm_ops: 'inf.manager_ops.v1',
};

const yaml = fs.readFileSync(YAML_PATH, 'utf-8');
const project = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8')) as ReturnType<typeof compileTopology>;
const { nodes, edges } = project;
const byId = (id: string) => nodes.find((n) => n.id === id)!;
const hasEdge = (s: string, t: string, kind: string) =>
  edges.some((e) => e.source === s && e.target === t && e.data!.kind === kind);

describe('influencer system topology v4 — DRAFT team-manager split', () => {
  it('compiles from the YAML to the delivered file, byte-identical', () => {
    const compiled = compileTopology(yaml, { customRoles: influencerRoleDefs });
    expect(compiled.nodes).toHaveLength(45);
    expect(compiled.edges).toHaveLength(82);
    expect(compiled.id).toBe('proj-influencers-system-v4');
    const text = `${serializeProject(compiled)}\n`;
    expect(text).toBe(fs.readFileSync(JSON_PATH, 'utf-8'));
    expect(crypto.createHash('sha256').update(text).digest('hex')).toBe(EXPECTED_SHA256);
  });

  it('has 45 nodes and 82 edges with stable ids', () => {
    expect(nodes).toHaveLength(45);
    expect(edges).toHaveLength(82);
    expect(new Set(nodes.map((n) => n.id)).size).toBe(45);
    expect(edges.every((e) => byId(e.source) && byId(e.target))).toBe(true);
  });

  it('keeps the v3 nodes and edges, plus 6 team managers', () => {
    // Every v3 node id is present (v3 file itself untouched — its own test guards the hash).
    const v3 = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'examples', 'influencers_system_v3.socroot.json'), 'utf-8')) as typeof project;
    for (const n of v3.nodes) expect(byId(n.id), `v3 node ${n.id}`).toBeTruthy();
    for (const id of TEAM_MANAGERS) {
      const tm = byId(id);
      expect(tm.data.role).toBe('manager');
      expect(tm.data.status).toBe('PLANNED');
      expect(tm.parentId).toBe('zone_dept');
      expect((tm.data.employee!.contract as { employee_id: string }).employee_id).toBe(TEAM_EMPLOYEE_IDS[id]);
    }
    expect(nodes.filter((n) => n.data.status === 'IMPLEMENTED').map((n) => n.id).sort())
      .toEqual(['bg', 'founder', 'kill', 'l2', 'pe', 'ssrf', 'zone_web']);
    expect(nodes.filter((n) => n.data.status === 'PLANNED')).toHaveLength(38);
  });

  it('dispatches in two levels: mgr → 6 team managers → their teams', () => {
    for (const tm of TEAM_MANAGERS) expect(hasEdge('mgr', tm, 'TASK_DISPATCH_RESULT'), `mgr>${tm}`).toBe(true);
    for (const tm of TEAM_MANAGERS) {
      for (const member of TEAM_MEMBERS[tm]!) expect(hasEdge(tm, member, 'TASK_DISPATCH_RESULT'), `${tm}>${member}`).toBe(true);
    }
    // No employee receives dispatch from two managers (no task conflict).
    const dispatchSources = new Map<string, string[]>();
    for (const e of edges.filter((x) => x.data!.kind === 'TASK_DISPATCH_RESULT')) {
      dispatchSources.set(e.target, [...(dispatchSources.get(e.target) ?? []), e.source]);
    }
    for (const [target, sources] of dispatchSources) expect(sources, target).toHaveLength(1);
    expect(edges.filter((e) => e.data!.kind === 'TASK_DISPATCH_RESULT')).toHaveLength(26);
  });

  it('escalates in two levels: team manager → mgr → founder', () => {
    for (const tm of TEAM_MANAGERS) expect(hasEdge(tm, 'mgr', 'ESCALATION_PATH'), `${tm}>mgr`).toBe(true);
    expect(hasEdge('mgr', 'founder', 'ESCALATION_PATH')).toBe(true);
    expect(edges.filter((e) => e.data!.kind === 'ESCALATION_PATH')).toHaveLength(7);
  });

  it('kill reaches each line manager (whole-cell halt), plus the v3 targets', () => {
    for (const tm of ['tm_line_1', 'tm_line_2', 'tm_line_3']) expect(hasEdge('kill', tm, 'KILL_PLANE_SIGNAL'), `kill>${tm}`).toBe(true);
    for (const t of ['mgr', 'publisher', 'creator_1', 'creator_2', 'creator_3']) expect(hasEdge('kill', t, 'KILL_PLANE_SIGNAL'), `kill>${t}`).toBe(true);
    expect(edges.filter((e) => e.data!.kind === 'KILL_PLANE_SIGNAL')).toHaveLength(8);
  });

  it('workload: mgr 6/6, each team manager 3–4 (v3 was mgr 20/20)', () => {
    const w = new Map(workloadOf(project).map((x) => [x.managerId, x]));
    expect(w.get('mgr')).toMatchObject({ tasks: 6, instances: 6 });
    expect(w.get('tm_acq')).toMatchObject({ tasks: 3, instances: 3 });
    expect(w.get('tm_ctx')).toMatchObject({ tasks: 4, instances: 4 });
    for (const tm of ['tm_line_1', 'tm_line_2', 'tm_line_3']) expect(w.get(tm)).toMatchObject({ tasks: 3, instances: 3 });
    expect(w.get('tm_ops')).toMatchObject({ tasks: 4, instances: 4 });
  });

  it('every memory store has exactly one writer team (no data overlap)', () => {
    // Writer team per store, from the MEMORY_BUS write edges themselves.
    const writers = new Map<string, Set<string>>();
    for (const e of edges.filter((x) => x.data!.kind === 'MEMORY_BUS' && x.data!.access === 'write')) {
      writers.set(e.target, new Set([...(writers.get(e.target) ?? []), e.source]));
    }
    const teamOfWriter = (writer: string): string => {
      if (writer === 'mgr') return 'department';
      for (const tm of TEAM_MANAGERS) if (TEAM_MEMBERS[tm]!.includes(writer)) return TEAM_OF[tm]!;
      return 'department';
    };
    const expected: Record<string, string[]> = {
      l1: ['collector', 'scout'],
      l2: ['transformer'],
      l3: ['custodian'],
      creator_profile_1: ['str'], creator_profile_2: ['str'], creator_profile_3: ['str'],
      income_register_1: ['transformer'], income_register_2: ['transformer'], income_register_3: ['transformer'],
    };
    for (const [store, who] of Object.entries(expected)) {
      expect([...(writers.get(store) ?? [])].sort(), store).toEqual(who);
      expect(new Set(who.map(teamOfWriter)).size, `${store} writers span teams`).toBe(1);
    }
  });

  it('has 28 unique employee contracts; contracts still name the department manager', () => {
    const ids = nodes
      .map((n) => (n.data.employee?.contract as { employee_id?: string } | undefined)?.employee_id)
      .filter((x): x is string => typeof x === 'string');
    expect(ids).toHaveLength(28);
    expect(new Set(ids).size).toBe(28);
    // Known limitation (see docs/V4_DRAFT.md): the contract manager_id is
    // still inf.manager.v1 for everyone — the team structure lives in the
    // dispatch/escalation cables. Unifying manager_id with the team needs
    // a per-node manager field (follow-up, not this draft).
    for (const n of nodes) {
      const c = n.data.employee?.contract as { manager_id?: string } | undefined;
      if (c) expect(c.manager_id).toBe('inf.manager.v1');
    }
  });

  it('header-row layout: team managers at row 0, zone 2160×954, right column shifted', () => {
    expect(byId('tm_acq').position).toEqual({ x: 320, y: 0 });
    expect(byId('tm_ctx').position).toEqual({ x: 640, y: 0 });
    expect(byId('tm_line_1').position).toEqual({ x: 960, y: 0 });
    expect(byId('tm_line_2').position).toEqual({ x: 1280, y: 0 });
    expect(byId('tm_line_3').position).toEqual({ x: 1600, y: 0 });
    expect(byId('tm_ops').position).toEqual({ x: 1920, y: 0 });
    expect(byId('mgr').position).toEqual({ x: 30, y: 510 });
    expect(byId('content_selector_1').position.y).toBe(340);
    expect(byId('creator_3').position.y).toBe(680);
    expect(byId('publisher').position.y).toBe(850);
    expect(byId('zone_dept').style).toMatchObject({ width: 2160, height: 954 });
    expect(byId('income_register_1').position).toEqual({ x: 2760, y: 850 });
    expect(byId('income_register_3').position).toEqual({ x: 2760, y: 1190 });
    expect(byId('pe').position).toEqual({ x: 2760, y: 1360 });
    expect(byId('bg').position).toEqual({ x: 2760, y: 1530 });
    expect(byId('kill').position).toEqual({ x: 470, y: 1120 });
    expect(findOverlaps(nodes)).toEqual([]);
  });

  it('passes the studio validation as judge (0 errors, 1 brief ORG-003 warning)', () => {
    const parsed = parseProjectText(serializeProject(project));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.migrated_from).toBeNull();
    for (const e of edges) {
      const r = checkCable(byId(e.source), byId(e.target), e.data!.kind, e.data!.access);
      expect(r.verdict.ok, `${e.id}: ${r.verdict.ok ? '' : r.verdict.reason}`).toBe(true);
    }
    const problems = collectProblems(nodes, edges, { tenant_id: 'socroot-core' });
    expect(errorCount(problems)).toBe(0);
    const warnings = problems.filter((p) => p.severity === 'warning');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.code).toBe('ORG-003');
    expect(warnings[0]!.message).toMatch(/27 employees/);
  });
});
