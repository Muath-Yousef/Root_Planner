import { describe, expect, it } from 'vitest';
import { MIGRATIONS, MigrationError, migrateProject } from '../src/persistence/migrations';
import { parseProjectText, serializeProject } from '../src/persistence/projectIO';
import { createAutosaver } from '../src/persistence/autosave';
import { CURRENT_FORMAT_VERSION } from '../src/schemas/project';
import { buildReferenceTopology } from '../src/presets/referenceTopology';

/** An older (format 1) file: plain `tenant_id`, no app/id/horizon/configs. */
const v1 = () => { const t = buildReferenceTopology('client_rls_001'); return { format_version: 1, name: 'Old company', tenant_id: 'client_rls_001', nodes: t.nodes, edges: t.edges }; };

describe('project migrations', () => {
  it('upgrades format 1 to the current format', () => {
    const r = migrateProject(v1());
    expect(r.from_version).toBe(1); expect(r.steps).toEqual([1]);
    expect(r.project.format_version).toBe(CURRENT_FORMAT_VERSION);
    expect(r.project).toMatchObject({ app: 'socroot-topology-studio', horizon: 'CURRENT', tenant: { tenant_id: 'client_rls_001', isolation: 'logical_rls' } });
    expect(Object.keys(r.project.configs).sort()).toEqual(['model_routing', 'pricing_config', 'sources_watchlist']);
  });
  it('a current file passes through unchanged and every hop below current has a migration', () => {
    const cur = migrateProject(v1()).project;
    expect(migrateProject(cur).steps).toEqual([]);
    for (let v = 1; v < CURRENT_FORMAT_VERSION; v++) expect(MIGRATIONS[v]).toBeTypeOf('function');
  });
  it('refuses files it cannot read, with a reason', () => {
    expect(() => migrateProject(null)).toThrow(MigrationError);
    expect(() => migrateProject({ name: 'x' })).toThrow(/format_version/);
    expect(() => migrateProject({ format_version: CURRENT_FORMAT_VERSION + 1 })).toThrow(/Update the studio/);
    expect(() => migrateProject({ format_version: 1, app: 'other' })).toThrow(/not created by/);
  });
  it('import: an older file is migrated and validated; garbage gets a readable error', () => {
    const ok = parseProjectText(JSON.stringify(v1()));
    expect(ok.ok).toBe(true); if (ok.ok) expect(ok.migrated_from).toBe(1);
    const bad = parseProjectText('{nope'); expect(bad.ok).toBe(false); if (!bad.ok) expect(bad.code).toBe('BAD_JSON');
  });
  it('export strips runtime-only fields and round-trips', () => {
    const p = migrateProject(v1()).project; p.nodes[0] = { ...p.nodes[0], selected: true };
    const text = serializeProject(p); expect(text).not.toContain('"selected"');
    const back = parseProjectText(text); expect(back.ok).toBe(true);
  });
});

describe('autosave', () => {
  it('coalesces a burst into one save and flush saves immediately', async () => {
    const saved: number[] = []; let fire: (() => void) | null = null;
    const a = createAutosaver<number>(async (v) => { saved.push(v); }, 500, { set: (f) => { fire = f; return 1; }, clear: () => { fire = null; } });
    a.schedule(1); a.schedule(2); a.schedule(3); expect(a.pending).toBe(true);
    fire!(); await Promise.resolve(); await Promise.resolve(); expect(saved).toEqual([3]);
    a.schedule(4); await a.flush(); expect(saved).toEqual([3, 4]); expect(a.pending).toBe(false);
  });
});
