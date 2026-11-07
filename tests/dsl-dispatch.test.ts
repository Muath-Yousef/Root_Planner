import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { compileTopology, DslError } from '../src/dsl/compiler';
import { checkCable } from '../src/engine/cablingValidator';
import { collectProblems, errorCount } from '../src/engine/problems';
import { parseProjectText, serializeProject } from '../src/persistence/projectIO';
import type { ProjectFile } from '../src/types';
import influencerRoleDefs from '../src/registry/roles/influencer';

/**
 * Phase 6 — bulk-dispatch rules (`dispatch:` in the DSL). Two rule names
 * replace a hand-listed manager fan-out: `department` (every employee of
 * the manager's department) and `line` (every employee instance of the
 * line template). The rules are judged exactly like the fan-out they
 * replace: the expansion must equal the hand-listed edges, in the same
 * order, and the compiled file must still pass the studio's own checks.
 */

const YAML_PATH = path.join(process.cwd(), 'examples', 'influencers_system_v3.yaml');
const JSON_PATH = path.join(process.cwd(), 'examples', 'influencers_system_v3.socroot.json');
const yaml = fs.readFileSync(YAML_PATH, 'utf-8');
const delivered = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8')) as ProjectFile;
const compileV3 = () => compileTopology(yaml, { customRoles: influencerRoleDefs });

const dispatchIds = (p: ProjectFile): string[] =>
  p.edges.filter((e) => e.data?.kind === 'TASK_DISPATCH_RESULT').map((e) => e.id);

/** A small spec with one department (zone_dept) and a 2-line template. */
const specWith = (edge: string, lines = true) => `project:
  id: proj-dispatch-test
  name: اختبار الإسناد
  tenant: socroot-core
  horizon: TRANSITIONAL
  created_at: '2026-11-07T06:19:00.000Z'
${lines ? `lines:
  count: 2
  nodes:
    - { id: "drf_{n}", role: drafter, at: [0, 170], step: [0, 170], parent: zone_dept }
` : ''}nodes:
  - { id: zone_dept, role: zone_line, at: [0, 0], label: القسم }
  - { id: mgr, role: manager, at: [0, 0], parent: zone_dept }
  - { id: scout, role: scout, at: [300, 0], parent: zone_dept }
  - { id: eva, role: evaluator, at: [600, 0], parent: zone_dept }
${lines ? '  - { lines: ["drf_{n}"] }\n' : ''}edges:
  ${edge}
`;

describe('Phase 6 — dispatch rules on the v3 example', () => {
  it('dispatch: [department, line] expands to the exact same 20 edges, in the same order', () => {
    const project = compileV3();
    expect(project.nodes).toHaveLength(39);
    expect(project.edges).toHaveLength(67);
    expect(dispatchIds(project)).toEqual(dispatchIds(delivered));
    expect(dispatchIds(project)).toEqual([
      'mgr>scout:TASK_DISPATCH_RESULT',
      'mgr>collector:TASK_DISPATCH_RESULT',
      'mgr>transformer:TASK_DISPATCH_RESULT',
      'mgr>ctx:TASK_DISPATCH_RESULT',
      'mgr>custodian:TASK_DISPATCH_RESULT',
      'mgr>eva:TASK_DISPATCH_RESULT',
      'mgr>str:TASK_DISPATCH_RESULT',
      'mgr>content_selector_1:TASK_DISPATCH_RESULT',
      'mgr>creator_1:TASK_DISPATCH_RESULT',
      'mgr>drf_1:TASK_DISPATCH_RESULT',
      'mgr>content_selector_2:TASK_DISPATCH_RESULT',
      'mgr>creator_2:TASK_DISPATCH_RESULT',
      'mgr>drf_2:TASK_DISPATCH_RESULT',
      'mgr>content_selector_3:TASK_DISPATCH_RESULT',
      'mgr>creator_3:TASK_DISPATCH_RESULT',
      'mgr>drf_3:TASK_DISPATCH_RESULT',
      'mgr>publisher:TASK_DISPATCH_RESULT',
      'mgr>compliance:TASK_DISPATCH_RESULT',
      'mgr>income_mgr:TASK_DISPATCH_RESULT',
      'mgr>perf_analyst:TASK_DISPATCH_RESULT',
    ]);
  });

  it('the rule-expanded v3 still passes the studio validation as judge (0 errors)', () => {
    const project = compileV3();
    const parsed = parseProjectText(serializeProject(project));
    expect(parsed.ok).toBe(true);
    const byId = (id: string) => project.nodes.find((n) => n.id === id)!;
    for (const e of project.edges) {
      const r = checkCable(byId(e.source), byId(e.target), e.data!.kind, e.data!.access);
      expect(r.verdict.ok, `${e.id}: ${r.verdict.ok ? '' : r.verdict.reason}`).toBe(true);
    }
    expect(errorCount(collectProblems(project.nodes, project.edges, { tenant_id: 'socroot-core' }))).toBe(0);
  });
});

describe('Phase 6 — dispatch rules on a small spec', () => {
  it('dispatch: [department, line] equals the hand-listed fan-out, order preserved', () => {
    const ruled = compileTopology(specWith('- { from: mgr, dispatch: [department, line], kind: TASK_DISPATCH_RESULT }'));
    const listed = compileTopology(specWith('- { from: mgr, to: [scout, eva, "drf_{n}"], kind: TASK_DISPATCH_RESULT }'));
    expect(dispatchIds(ruled)).toEqual(['mgr>scout:TASK_DISPATCH_RESULT', 'mgr>eva:TASK_DISPATCH_RESULT', 'mgr>drf_1:TASK_DISPATCH_RESULT', 'mgr>drf_2:TASK_DISPATCH_RESULT']);
    expect(dispatchIds(ruled)).toEqual(dispatchIds(listed));
    expect(serializeProject(ruled)).toBe(serializeProject(listed));
  });

  it('dispatch: department alone covers the line instances too (they are department children)', () => {
    const project = compileTopology(specWith('- { from: mgr, dispatch: department, kind: TASK_DISPATCH_RESULT }'));
    expect(dispatchIds(project)).toEqual(['mgr>scout:TASK_DISPATCH_RESULT', 'mgr>eva:TASK_DISPATCH_RESULT', 'mgr>drf_1:TASK_DISPATCH_RESULT', 'mgr>drf_2:TASK_DISPATCH_RESULT']);
  });

  it('dispatch: line alone reaches only the line instances, line-major', () => {
    const project = compileTopology(specWith('- { from: mgr, dispatch: line, kind: TASK_DISPATCH_RESULT }'));
    expect(dispatchIds(project)).toEqual(['mgr>drf_1:TASK_DISPATCH_RESULT', 'mgr>drf_2:TASK_DISPATCH_RESULT']);
  });

  it('the union is ordered by file order, not grouped by rule — [line, department] gives the same edges', () => {
    const a = compileTopology(specWith('- { from: mgr, dispatch: [department, line], kind: TASK_DISPATCH_RESULT }'));
    const b = compileTopology(specWith('- { from: mgr, dispatch: [line, department], kind: TASK_DISPATCH_RESULT }'));
    expect(dispatchIds(b)).toEqual(dispatchIds(a));
    expect(serializeProject(b)).toBe(serializeProject(a));
  });

  it('the manager itself is never a dispatch target', () => {
    const project = compileTopology(specWith('- { from: mgr, dispatch: department, kind: TASK_DISPATCH_RESULT }'));
    expect(dispatchIds(project).some((id) => id.startsWith('mgr>mgr:'))).toBe(false);
  });

  it('refuses: unknown rule, dispatch + to, wrong kind, multi-source, sourceless department, line without lines', () => {
    expect(() => compileTopology(specWith('- { from: mgr, dispatch: everyone, kind: TASK_DISPATCH_RESULT }')))
      .toThrowError(DslError);
    expect(() => compileTopology(specWith('- { from: mgr, dispatch: everyone, kind: TASK_DISPATCH_RESULT }')))
      .toThrowError(/غير معروفة/);
    expect(() => compileTopology(specWith('- { from: mgr, to: [scout], dispatch: line, kind: TASK_DISPATCH_RESULT }')))
      .toThrowError(/dispatch وto معاً/);
    expect(() => compileTopology(specWith('- { from: mgr, dispatch: line, kind: MEMORY_BUS }')))
      .toThrowError(/TASK_DISPATCH_RESULT فقط/);
    expect(() => compileTopology(specWith('- { from: [mgr, scout], dispatch: line, kind: TASK_DISPATCH_RESULT }')))
      .toThrowError(/مصدراً واحداً/);
    const noParent = `project:
  id: proj-dispatch-test
  name: اختبار الإسناد
  tenant: socroot-core
  horizon: TRANSITIONAL
nodes:
  - { id: mgr, role: manager, at: [0, 0] }
  - { id: scout, role: scout, at: [300, 0] }
edges:
  - { from: mgr, dispatch: department, kind: TASK_DISPATCH_RESULT }
`;
    expect(() => compileTopology(noParent)).toThrowError(/بلا أب/);
    expect(() => compileTopology(specWith('- { from: mgr, dispatch: line, kind: TASK_DISPATCH_RESULT }', false)))
      .toThrowError(/تتطلب قسم lines/);
  });
});
