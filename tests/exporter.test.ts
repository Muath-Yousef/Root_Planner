import { describe, expect, it } from 'vitest';
import { buildBundle, planBundle } from '../src/engine/bundleExporter';
import { buildReferenceTopology } from '../src/presets/referenceTopology';
import { defaultConfigs } from '../src/presets/defaultConfigs';
import { START_TEMPLATES, createProject } from '../src/presets/startTemplates';
import { collectProblems, errorCount } from '../src/engine/problems';
import { initialPlayer, isFinished, playerReducer } from '../src/engine/simPlayer';
import { runSimulation } from '../src/engine/simulationRunner';
import { parseWatchlist } from '../src/engine/ssrfGuard';

const cfg = defaultConfigs();
const topo = () => structuredClone(buildReferenceTopology('socroot-core'));
const SIX = ['contract.json', 'manifest.yaml', 'employee.py', 'tools.py', 'policies.py'];

describe('bundle exporter', () => {
  it('the reference company is exportable and every employee gets the six-file bundle plus config/*.yaml', () => {
    const t = topo(); const r = buildBundle(t.nodes, t.edges, cfg, 'socroot-core');
    expect(r.ok).toBe(true); if (!r.ok) return;
    const paths = r.bundle.files.map((f) => f.path);
    expect(r.bundle.employees).toBeGreaterThan(5);
    for (const f of SIX) expect(paths.filter((p) => p.endsWith(`/${f}`)).length).toBe(r.bundle.employees);
    expect(paths).toContain('config/model_routing.yaml'); expect(paths).toContain('config/sources_watchlist.yaml'); expect(paths).toContain('config/pricing_config.yaml');
    expect(paths.some((p) => p.startsWith('departments/dept_opportunity_acquisition/opp_acq.drafter.v1/'))).toBe(true);
    expect(paths.some((p) => p.includes('/skills/'))).toBe(true);
  });
  it('ORG-003: a department that is not IMPLEMENTED gets no folder', () => {
    const t = topo(); t.nodes.find((n) => n.id === 'zone_dept')!.data.status = 'PARTIAL';
    const b = planBundle(t.nodes, cfg);
    expect(b.files.some((f) => f.path.startsWith('departments/dept_opportunity_acquisition'))).toBe(false);
    expect(b.skipped.length).toBeGreaterThan(5); expect(b.skipped.every((s) => s.code === 'ORG-003')).toBe(true);
  });
  it('an error blocks the export and names the rule (drafter with a network)', () => {
    const t = topo(); const d = t.nodes.find((n) => n.id === 'drf')!.data.employee!;
    (d.contract as { runtime_config: { docker_network: string } }).runtime_config.docker_network = 'internal';
    const r = buildBundle(t.nodes, t.edges, cfg, 'socroot-core');
    expect(r.ok).toBe(false); if (!r.ok) expect(r.errors.some((e) => e.code === 'POL_DRF_HARD_01')).toBe(true);
  });
});

describe('start templates and wizard', () => {
  it('every template builds a valid project; non-blank ones have no errors', () => {
    for (const tpl of START_TEMPLATES) {
      const r = createProject({ name: tpl.label.en, tenant_id: tpl.tenant_id, template: tpl.id });
      expect(r.ok).toBe(true); if (!r.ok) continue;
      expect(r.project.nodes.length > 0).toBe(tpl.id !== 'blank');
      expect(errorCount(collectProblems(r.project.nodes, r.project.edges, { tenant_id: tpl.tenant_id }))).toBe(0);
    }
  });
  it('TEN-004 is dedicated, at the TARGET horizon, with its boundary zone', () => {
    const r = createProject({ name: 'Big client', tenant_id: 'client_ten004', template: 'ten004' });
    expect(r.ok).toBe(true); if (r.ok) { expect(r.project.tenant.isolation).toBe('dedicated'); expect(r.project.horizon).toBe('TARGET'); expect(r.project.nodes[0].id).toBe('zone_dedicated'); }
  });
  it('rejects an empty name and a bad tenant id with a reason in both languages', () => {
    const a = createProject({ name: '  ', tenant_id: 'client_x1', template: 'blank' }); expect(a.ok).toBe(false); if (!a.ok) { expect(a.field).toBe('name'); expect(a.message.ar.length).toBeGreaterThan(3); }
    const b = createProject({ name: 'X', tenant_id: 'A', template: 'blank' }); expect(b.ok).toBe(false); if (!b.ok) expect(b.code).toBe('WIZ_TENANT_ID');
  });
  it('a custom tenant defaults to logical isolation', () => {
    const r = createProject({ name: 'Acme', tenant_id: 'acme_corp', template: 'rls' }); expect(r.ok && r.project.tenant.isolation).toBe('logical_rls');
  });
});

describe('simulation player', () => {
  it('step, play, tick, stop and reset behave', async () => {
    const run = await runSimulation({ fit_score: 88, ssrf: parseWatchlist(cfg.sources_watchlist) });
    let s = playerReducer(initialPlayer, { type: 'load', total: run.steps.length });
    s = playerReducer(s, { type: 'step' }); expect(s.revealed).toBe(1); expect(s.playing).toBe(false);
    s = playerReducer(s, { type: 'play' }); s = playerReducer(s, { type: 'tick' }); expect(s.revealed).toBe(2); expect(s.playing).toBe(true);
    s = playerReducer(s, { type: 'stop' }); s = playerReducer(s, { type: 'tick' }); expect(s.revealed).toBe(2);
    s = playerReducer(s, { type: 'play' }); for (let i = 0; i < 50; i++) s = playerReducer(s, { type: 'tick' });
    expect(isFinished(s)).toBe(true); expect(s.playing).toBe(false);
    s = playerReducer(s, { type: 'play' }); expect(s.revealed).toBe(0); expect(s.playing).toBe(true);
    s = playerReducer(s, { type: 'reset' }); expect(s).toEqual({ total: run.steps.length, revealed: 0, playing: false });
  });
});
