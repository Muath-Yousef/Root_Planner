import { describe, expect, it } from 'vitest';
import { deleteProject, lastProjectId, listProjects, loadProject, saveProject } from '../src/persistence/projectStore';
import { migrateProject } from '../src/persistence/migrations';
import { buildReferenceTopology } from '../src/presets/referenceTopology';

// IndexedDB comes from fake-indexeddb (tests/setup.ts).
const make = (id: string, name: string) => { const t = buildReferenceTopology(); return migrateProject({ format_version: 1, id, name, tenant_id: 'socroot-core', nodes: t.nodes, edges: t.edges }).project; };
describe('IndexedDB project store', () => {
  it('keeps several companies, restores them after a "reload", and deletes one', async () => {
    await saveProject(make('a', 'Company A')); await saveProject(make('b', 'Company B'));
    expect((await listProjects()).map((p) => p.id).sort()).toEqual(['a', 'b']);
    expect(await lastProjectId()).toBe('b');
    const a = await loadProject('a'); expect(a?.name).toBe('Company A'); expect(a?.nodes.length).toBeGreaterThan(10);
    await deleteProject('a'); expect(await loadProject('a')).toBeNull(); expect((await listProjects()).map((p) => p.id)).toEqual(['b']);
  });
});
