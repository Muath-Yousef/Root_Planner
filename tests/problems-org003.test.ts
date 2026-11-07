import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { compileTopology } from '../src/dsl/compiler';
import { collectProblems, errorCount } from '../src/engine/problems';
import { parseProjectText } from '../src/persistence/projectIO';
import type { ProjectFile } from '../src/types';

/**
 * Phase 6 — ORG-003 scoping: one brief warning per planned department
 * (default), with the full per-node list available via `{ org003:
 * 'per-node' }` (CLI `validate --verbose`). The warning keeps its
 * original meaning — no folder will be created for the planned
 * department on export — it only stops repeating once per employee.
 */

const ROOT = process.cwd();
const load = (name: string): ProjectFile => {
  const text = fs.readFileSync(path.join(ROOT, 'examples', name), 'utf-8');
  const parsed = parseProjectText(text);
  if (!parsed.ok) throw new Error(`cannot load ${name}: ${parsed.message}`);
  return parsed.project;
};
const V1 = load('influencers_system.socroot.json');
const V2 = load('influencers_system_v2.socroot.json');
const V3 = load('influencers_system_v3.socroot.json');
const org003 = (p: ProjectFile, opts?: Parameters<typeof collectProblems>[3]) =>
  collectProblems(p.nodes, p.edges, { tenant_id: 'socroot-core' }, opts).filter((x) => x.code === 'ORG-003');

/** Two planned departments, two employees each — no dispatch edges. */
const TWO_DEPTS = `project:
  id: proj-org003-test
  name: اختبار الأقسام
  tenant: socroot-core
  horizon: TRANSITIONAL
nodes:
  - { id: zone_a, role: zone_line, at: [0, 0], label: القسم أ, status: PLANNED }
  - { id: zone_b, role: zone_line, at: [0, 400], label: القسم ب, status: PLANNED }
  - { id: mgr_a, role: manager, at: [0, 0], parent: zone_a, employee_id: inf.mgr_a.v1 }
  - { id: scout_a, role: scout, at: [300, 0], parent: zone_a, employee_id: inf.scout_a.v1 }
  - { id: mgr_b, role: manager, at: [0, 0], parent: zone_b, employee_id: inf.mgr_b.v1 }
  - { id: scout_b, role: scout, at: [300, 0], parent: zone_b, employee_id: inf.scout_b.v1 }
edges: []
`;

describe('Phase 6 — ORG-003 brief by default', () => {
  it.each([
    ['v1', V1, 6],
    ['v2', V2, 15],
    ['v3', V3, 21],
  ])('%s: 0 errors and exactly 1 brief ORG-003 warning (was %i per node)', (_name, project, _perNode) => {
    expect(errorCount(collectProblems(project.nodes, project.edges, { tenant_id: 'socroot-core' }))).toBe(0);
    const warnings = org003(project);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.severity).toBe('warning');
    expect(warnings[0]!.message).toContain('dept_influencer_system');
    expect(warnings[0]!.message).toContain('no folder will be created');
  });

  it('v3 brief warning names the department and its headcount (21 employees)', () => {
    const warnings = org003(V3);
    expect(warnings[0]!.message).toBe(
      'Department dept_influencer_system (PLANNED): 21 employees — no folder will be created for it.',
    );
    // The brief warning points at the department (zone) node, not at one employee.
    expect(warnings[0]!.nodeId).toBe('zone_dept');
  });

  it('one brief warning per planned department — two departments give two warnings', () => {
    const project = compileTopology(TWO_DEPTS);
    expect(errorCount(collectProblems(project.nodes, project.edges, { tenant_id: 'socroot-core' }))).toBe(0);
    const warnings = org003(project);
    expect(warnings).toHaveLength(2);
    expect(warnings.map((w) => w.message).sort()).toEqual([
      'Department القسم أ (PLANNED): 2 employees — no folder will be created for it.',
      'Department القسم ب (PLANNED): 2 employees — no folder will be created for it.',
    ]);
    expect(new Set(warnings.map((w) => w.nodeId))).toEqual(new Set(['zone_a', 'zone_b']));
  });

  it('an IMPLEMENTED department produces no ORG-003 warning', () => {
    const project = compileTopology(TWO_DEPTS.replaceAll('status: PLANNED', 'status: IMPLEMENTED'));
    expect(org003(project)).toHaveLength(0);
  });
});

describe('Phase 6 — ORG-003 per-node detail preserved', () => {
  it.each([
    ['v1', V1, 6],
    ['v2', V2, 15],
    ['v3', V3, 21],
  ])('%s: { org003: per-node } restores the full per-employee list (%i)', (_name, project, perNode) => {
    const warnings = org003(project, { org003: 'per-node' });
    expect(warnings).toHaveLength(perNode);
    for (const w of warnings) {
      expect(w.message).toMatch(/is in a department whose status is PLANNED\. No folder will be created for it\./);
      expect(w.nodeId).not.toBe('zone_dept');
    }
  });

  it('two departments give the per-node list across both (2 + 2)', () => {
    const project = compileTopology(TWO_DEPTS);
    const warnings = org003(project, { org003: 'per-node' });
    expect(warnings).toHaveLength(4);
    expect(new Set(warnings.map((w) => w.nodeId))).toEqual(new Set(['mgr_a', 'scout_a', 'mgr_b', 'scout_b']));
  });
});
