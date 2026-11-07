import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadProject, workloadFile, workloadOf } from '../src/cli/commands';
import type { ProjectFile } from '../src/types';

/**
 * Phase 6 — workload view: for each manager, the number of assigned
 * tasks (outgoing TASK_DISPATCH_RESULT edges) and the number of distinct
 * instances under supervision. The manager itself is never counted as
 * its own employee.
 */

const ROOT = process.cwd();
const V3 = path.join(ROOT, 'examples', 'influencers_system_v3.socroot.json');
const V3_YAML = path.join(ROOT, 'examples', 'influencers_system_v3.yaml');

describe('Phase 6 — workload view (function)', () => {
  it('v3: one manager → 20 tasks, 20 instances (the manager itself not counted)', async () => {
    const project = await loadProject(V3);
    const managers = workloadOf(project);
    expect(managers).toHaveLength(1);
    expect(managers[0]).toEqual({
      managerId: 'mgr',
      managerLabel: 'مدير قطاع المؤثرين',
      tasks: 20,
      instances: 20,
    });
  });

  it('v3 YAML gives the same workload as the delivered v3 JSON', async () => {
    const report = await workloadFile(V3_YAML);
    expect(report.file).toBe(V3_YAML);
    expect(report.managers).toEqual([
      { managerId: 'mgr', managerLabel: 'مدير قطاع المؤثرين', tasks: 20, instances: 20 },
    ]);
  });

  it('tasks and instances differ when one employee receives several tasks', () => {
    const project = {
      nodes: [
        { id: 'mgr', data: { label: 'المدير', role: 'manager' } },
        { id: 'scout', data: { label: 'المستطلع', role: 'scout' } },
        { id: 'eva', data: { label: 'المقيّم', role: 'evaluator' } },
      ],
      edges: [
        { id: 'mgr>scout:TASK_DISPATCH_RESULT', source: 'mgr', target: 'scout', data: { kind: 'TASK_DISPATCH_RESULT' } },
        { id: 'mgr>scout:TASK_DISPATCH_RESULT#2', source: 'mgr', target: 'scout', data: { kind: 'TASK_DISPATCH_RESULT' } },
        { id: 'mgr>eva:TASK_DISPATCH_RESULT', source: 'mgr', target: 'eva', data: { kind: 'TASK_DISPATCH_RESULT' } },
        { id: 'mgr>mgr:TASK_DISPATCH_RESULT', source: 'mgr', target: 'mgr', data: { kind: 'TASK_DISPATCH_RESULT' } },
      ],
    } as unknown as ProjectFile;
    // 4 dispatched edges, but only 2 distinct supervisees — and the
    // self-edge counts as a dispatched task, never as a supervisee.
    expect(workloadOf(project)).toEqual([
      { managerId: 'mgr', managerLabel: 'المدير', tasks: 4, instances: 2 },
    ]);
  });

  it('a project with no dispatching manager reports no managers', () => {
    const project = {
      nodes: [{ id: 'founder', data: { label: 'المؤسس', role: 'founder' } }],
      edges: [],
    } as unknown as ProjectFile;
    expect(workloadOf(project)).toEqual([]);
  });

  it('workloadFile throws on a broken file', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'socroot-workload-'));
    try {
      const broken = path.join(tmp, 'broken.socroot.json');
      fs.writeFileSync(broken, '{"bad": 1}', 'utf-8');
      await expect(workloadFile(broken)).rejects.toThrow();
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('Phase 6 — workload view (CLI end-to-end)', () => {
  const tsx = path.join(ROOT, 'node_modules', '.bin', 'tsx');
  const run = (args: string[]) => spawnSync(tsx, ['src/cli/index.ts', ...args], { cwd: ROOT, encoding: 'utf-8' });

  it('workload exits 0 on v3 and prints mgr → 20 tasks, 20 instances', { timeout: 30000 }, () => {
    const r = run(['workload', V3]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/عبء العمل/);
    expect(r.stdout).toMatch(/mgr \(مدير قطاع المؤثرين\): 20 مهمة مسندة، 20 مثيلاً تحت الإشراف/);
  });

  it('workload accepts the v3 YAML too', { timeout: 30000 }, () => {
    const r = run(['workload', V3_YAML]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/20 مهمة مسندة، 20 مثيلاً تحت الإشراف/);
  });

  it('unknown command and --verbose outside validate exit 1', { timeout: 30000 }, () => {
    expect(run(['workload']).status).toBe(1);
    const r = run(['build', V3_YAML, '--verbose']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/--verbose يخص validate فقط/);
  });
});
