import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DEFAULT_PORTS, dockTemplates, getRole, portsFor } from '../src/registry';
import { buildFile, exportFile, validateFile } from '../src/cli/commands';

/**
 * Phase 4 — the CLI (validate / build / export) and the registered
 * influencer roles. The CLI is judged by the studio's own checks and by
 * the delivered files: validate must accept v1/v2/v3, build of the v3
 * YAML must reproduce the delivered v3 file byte-identically.
 */

const ROOT = process.cwd();
const V1 = path.join(ROOT, 'examples', 'influencers_system.socroot.json');
const V2 = path.join(ROOT, 'examples', 'influencers_system_v2.socroot.json');
const V3 = path.join(ROOT, 'examples', 'influencers_system_v3.socroot.json');
const V3_YAML = path.join(ROOT, 'examples', 'influencers_system_v3.yaml');
const V3_SHA256 = 'ac9f04781e22f0de54a0ebc04a00133ee861c6525274c48aeb26bd2be0256ed1';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'socroot-cli-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const sha256 = (p: string): string => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

describe('Phase 4 — registered influencer roles', () => {
  it('collector / content_selector / creator resolve with their declared least-privilege permissions', () => {
    for (const id of ['collector', 'content_selector', 'creator']) {
      const def = getRole(id);
      expect(def, id).toBeDefined();
      expect(def!.kind).toBe('employee');
      expect(def!.category).toBe('Employees');
      expect(def!.architecture_horizon).toBe('TRANSITIONAL');
      expect(def!.implementation_status).toBe('PLANNED');
      const perms = def!.permissions!;
      expect(perms.grants).toEqual(['model:invoke', 'task:read', 'task:complete']);
      expect(perms.prohibitions).toEqual(['web:*', 'external:*', 'funds:*', 'storage:audit_modify']);
      expect(perms.source).toBe('derived');
      expect(def!.employee).toBeDefined();
    }
  });

  it('the roles appear in the dock (TRANSITIONAL) with no custom ports — DEFAULT_PORTS still apply', () => {
    const ids = dockTemplates('TRANSITIONAL').map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(['collector', 'content_selector', 'creator']));
    for (const id of ['collector', 'content_selector', 'creator']) {
      expect(getRole(id)!.ports).toBeUndefined();
      expect(portsFor('employee', id)).toEqual(DEFAULT_PORTS.employee);
    }
  });
});

describe('Phase 4 — CLI validate', () => {
  it('accepts the three delivered files: 0 errors (1 brief ORG-003 warning each — Phase 6)', async () => {
    const v1 = await validateFile(V1);
    expect(v1.ok).toBe(true);
    expect(v1.errors).toEqual([]);
    expect(v1.warnings).toHaveLength(1);
    expect([v1.nodes, v1.edges]).toEqual([17, 13]);
    const v2 = await validateFile(V2);
    expect(v2.ok).toBe(true);
    expect(v2.errors).toEqual([]);
    expect(v2.warnings).toHaveLength(1);
    expect([v2.nodes, v2.edges]).toEqual([29, 43]);
    const v3 = await validateFile(V3);
    expect(v3.ok).toBe(true);
    expect(v3.errors).toEqual([]);
    expect(v3.warnings).toHaveLength(1);
    expect([v3.nodes, v3.edges]).toEqual([39, 67]);
  });

  it('accepts the v3 YAML (same 0 errors, same 1 brief warning)', async () => {
    const report = await validateFile(V3_YAML);
    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toHaveLength(1);
    expect([report.nodes, report.edges]).toEqual([39, 67]);
  });

  it('validate --verbose restores the full per-node ORG-003 list (v3: 21)', async () => {
    const report = await validateFile(V3, { verbose: true });
    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toHaveLength(21);
    expect(new Set(report.warnings.map((w) => w.split(':')[0]))).toEqual(new Set(['ORG-003']));
  });

  it('rejects a broken file: bad JSON, wrong shape, unknown YAML role', async () => {
    const badJson = path.join(tmp, 'bad.socroot.json');
    fs.writeFileSync(badJson, '{"nodes": [', 'utf-8');
    const r1 = await validateFile(badJson);
    expect(r1.ok).toBe(false);
    expect(r1.errors.join(' ')).toMatch(/BAD_JSON/);

    const wrongShape = path.join(tmp, 'wrong.socroot.json');
    fs.writeFileSync(wrongShape, '{"bad": 1}', 'utf-8');
    const r2 = await validateFile(wrongShape);
    expect(r2.ok).toBe(false);
    expect(r2.errors.length).toBeGreaterThan(0);

    const ghostYaml = path.join(tmp, 'ghost.yaml');
    fs.writeFileSync(ghostYaml, 'project:\n  id: proj-ghost\n  name: شبح\n  tenant: socroot-core\n  horizon: TRANSITIONAL\nnodes:\n  - { id: x1, role: ghost_role, at: [0, 0], label: س }\n  - { id: founder, role: founder, at: [0, 0], label: المؤسس }\nedges: []\n', 'utf-8');
    const r3 = await validateFile(ghostYaml);
    expect(r3.ok).toBe(false);
    expect(r3.errors.join(' ')).toMatch(/ghost_role/);
  });
});

describe('Phase 4 — CLI build / export', () => {
  it('build of the v3 YAML is deterministic and byte-identical to the delivered v3 file', async () => {
    const out1 = path.join(tmp, 'v3-a.socroot.json');
    const out2 = path.join(tmp, 'v3-b.socroot.json');
    const r1 = await buildFile(V3_YAML, { out: out1 });
    const r2 = await buildFile(V3_YAML, { out: out2 });
    expect(r1.sha256).toBe(V3_SHA256);
    expect(r2.sha256).toBe(V3_SHA256);
    expect(fs.readFileSync(out1, 'utf-8')).toBe(fs.readFileSync(V3, 'utf-8'));
    expect(fs.readFileSync(out1)).toEqual(fs.readFileSync(out2));
    expect([r1.nodes, r1.edges]).toEqual([39, 67]);
  });

  it('build honours --now over the YAML created_at, changing only the two timestamps', async () => {
    const out = path.join(tmp, 'v3-now.socroot.json');
    const r = await buildFile(V3_YAML, { out, now: '2030-01-01T00:00:00.000Z' });
    const text = fs.readFileSync(out, 'utf-8');
    expect(text).toContain('2030-01-01T00:00:00.000Z');
    expect(text.replaceAll('2030-01-01T00:00:00.000Z', '2026-11-07T06:19:00.000Z')).toBe(fs.readFileSync(V3, 'utf-8'));
    expect(r.sha256).not.toBe(V3_SHA256);
  });

  it('build refuses a non-YAML input', async () => {
    await expect(buildFile(V3)).rejects.toThrowError(/YAML/);
  });

  it('export writes a canonical copy: JSON input byte-identical, YAML input same hash', async () => {
    const fromJson = path.join(tmp, 'v3-export-json.socroot.json');
    const r1 = await exportFile(V3, fromJson);
    expect(r1.sha256).toBe(V3_SHA256);
    expect(fs.readFileSync(fromJson, 'utf-8')).toBe(fs.readFileSync(V3, 'utf-8'));
    const fromYaml = path.join(tmp, 'v3-export-yaml.socroot.json');
    const r2 = await exportFile(V3_YAML, fromYaml);
    expect(r2.sha256).toBe(V3_SHA256);
    expect(sha256(fromYaml)).toBe(V3_SHA256);
  });

  it('export refuses a project that fails validation', async () => {
    const broken = path.join(tmp, 'broken.socroot.json');
    fs.writeFileSync(broken, '{"bad": 1}', 'utf-8');
    await expect(exportFile(broken, path.join(tmp, 'out.socroot.json'))).rejects.toThrowError(/لا يمكن تصدير/);
  });
});

describe('Phase 4 — CLI end-to-end (spawned)', () => {
  const tsx = path.join(ROOT, 'node_modules', '.bin', 'tsx');
  const run = (args: string[]) => spawnSync(tsx, ['src/cli/index.ts', ...args], { cwd: ROOT, encoding: 'utf-8' });

  it('validate exits 0 on v3 and 1 on a broken file', { timeout: 30000 }, () => {
    const ok = run(['validate', V3]);
    expect(ok.status).toBe(0);
    expect(ok.stdout).toMatch(/0 أخطاء، 1 تحذيراً/);
    expect(ok.stdout).toMatch(/Department dept_influencer_system \(PLANNED\): 21 employees/);
    const verbose = run(['validate', V3, '--verbose']);
    expect(verbose.status).toBe(0);
    expect(verbose.stdout).toMatch(/0 أخطاء، 21 تحذيراً/);
    const broken = path.join(tmp, 'broken-e2e.socroot.json');
    fs.writeFileSync(broken, '{"bad": 1}', 'utf-8');
    const bad = run(['validate', broken]);
    expect(bad.status).toBe(1);
    expect(bad.stderr).toMatch(/خطأ/);
  });

  it('build exits 0 and reproduces the v3 hash', { timeout: 30000 }, () => {
    const out = path.join(tmp, 'v3-e2e.socroot.json');
    const r = run(['build', V3_YAML, '--out', out]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(V3_SHA256);
    expect(sha256(out)).toBe(V3_SHA256);
  });

  it('unknown command exits 1 with usage', { timeout: 30000 }, () => {
    const r = run(['frobnicate', V3]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/غير معروف/);
  });
});
