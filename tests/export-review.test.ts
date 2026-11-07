import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { diffFiles, exportImageFile, loadProject, reviewFile } from '../src/cli/commands';
import { renderTopologySvg, topologyGeometry } from '../src/engine/topologyImage';
import { pngSize } from '../src/engine/topologyPng';

/**
 * Phase 5 — built-in image export (SVG/PNG), version diff, pre-publish
 * review. The SVG is judged against the delivered pictures: same canvas
 * size the Python renderer computed, every node and edge drawn, cable
 * colours from CABLE_DEFS; the diff is judged against the known v2→v3
 * counts (+10 nodes / +24 edges net, with added AND removed listed).
 */

const ROOT = process.cwd();
const V1 = path.join(ROOT, 'examples', 'influencers_system.socroot.json');
const V2 = path.join(ROOT, 'examples', 'influencers_system_v2.socroot.json');
const V3 = path.join(ROOT, 'examples', 'influencers_system_v3.socroot.json');
const V1_SHA256 = '6386032a8db0de96ade7636af451c275d4250b119896bbac0aa46905a84e0272';
const V2_SHA256 = 'b035d53207c1e7c033ef2d7c474a5b188213441762189568ccb219b6db34fcc1';
const V3_SHA256 = 'ac9f04781e22f0de54a0ebc04a00133ee861c6525274c48aeb26bd2be0256ed1';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'socroot-export-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const sha256 = (p: string): string => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

const hasChromium = (): boolean => {
  try {
    return fs.readdirSync(path.join(os.homedir(), '.cache', 'ms-playwright')).some((d) => d.startsWith('chromium'));
  } catch {
    return false;
  }
};

describe('Phase 5 — the three delivered files are untouched', () => {
  it('v1/v2/v3 hashes still match the delivered files', () => {
    expect(sha256(V1)).toBe(V1_SHA256);
    expect(sha256(V2)).toBe(V2_SHA256);
    expect(sha256(V3)).toBe(V3_SHA256);
  });
});

describe('Phase 5 — SVG export', () => {
  it('v3 renders at the delivered canvas size 4175x2153 (v2 3437x1553, v1 2125x1328)', async () => {
    for (const [file, w, h] of [[V3, 4175, 2153], [V2, 3437, 1553], [V1, 2125, 1328]] as const) {
      const svg = renderTopologySvg(await loadProject(file));
      expect(svg).toContain(`width="${w}" height="${h}"`);
    }
  });

  it('v3 SVG is deterministic and contains every node and edge', async () => {
    const project = await loadProject(V3);
    const a = renderTopologySvg(project);
    const b = renderTopologySvg(project);
    expect(a).toBe(b);
    expect(a.startsWith('<svg')).toBe(true);
    for (const n of project.nodes) {
      expect(a).toContain(`data-node="${n.id}"`);
      expect(a).toContain(n.data.label);
    }
    expect((a.match(/data-node="/g) ?? []).length).toBe(39);
    expect((a.match(/data-edge="/g) ?? []).length).toBe(67);
    for (const kind of ['OBJECTIVE_ROUTE', 'TASK_DISPATCH_RESULT', 'ESCALATION_PATH', 'MEMORY_BUS', 'EGRESS_NETWORK', 'KILL_PLANE_SIGNAL']) {
      expect(a).toContain(`data-kind="${kind}"`);
    }
  });

  it('SVG uses the studio cable colours and labels only the structure-carrying kinds', async () => {
    const svg = renderTopologySvg(await loadProject(V3));
    for (const color of ['#f2b23a', '#2cc4dd', '#f2803a', '#a66cf0', '#34c48b', '#ef4b4b']) {
      expect(svg).toContain(`stroke="${color}"`);
    }
    // Edge labels: هدف / تصعيد / خروج only — no dispatch/memory/kill labels on the curves.
    expect(svg).toContain('>هدف<');
    expect(svg).toContain('>تصعيد<');
    expect(svg).toContain('>خروج<');
    expect(svg).not.toContain('>إسناد<');
    expect(svg).not.toContain('>ذاكرة<');
    expect(svg).not.toContain('>إيقاف<');
    expect(svg).toContain('مفتاح الخريطة');
  });

  it('estimated node widths stay within 35px of the Python renderer and every label fits', async () => {
    const project = await loadProject(V3);
    const boxes = topologyGeometry(project).boxes;
    // Python-measured box widths for v3's wide nodes (label width + 36);
    // every other node sits at the 200 floor.
    const pythonWide: Record<string, number> = {
      collector: 209, transformer: 229, compliance: 234, ssrf: 262, l2: 270, l3: 206,
      creator_profile_1: 270, creator_profile_2: 270, creator_profile_3: 270,
      income_register_1: 269, income_register_2: 269, income_register_3: 269,
    };
    for (const [id, pyBox] of Object.entries(pythonWide)) {
      const box = boxes.get(id)!.w;
      expect(Math.abs(box - pyBox), id).toBeLessThanOrEqual(35);
      expect(box, `${id} must fit its label`).toBeGreaterThanOrEqual(pyBox - 36);
    }
    for (const n of project.nodes) {
      if (n.data.kind === 'zone') continue;
      const expected = pythonWide[n.id] ?? 200;
      expect(Math.abs(boxes.get(n.id)!.w - expected), n.id).toBeLessThanOrEqual(35);
    }
  });
});

describe('Phase 5 — version diff', () => {
  it('v2→v3: net +10 nodes and +24 edges, with added AND removed listed', async () => {
    const { diff } = await diffFiles(V2, V3);
    expect(diff.nodesAdded).toHaveLength(15);
    expect(diff.nodesRemoved).toEqual(['content_selector', 'creator', 'creator_profile', 'drf', 'income_register']);
    expect(diff.nodesChanged).toHaveLength(23);
    expect(diff.netNodes).toBe(10);
    expect(diff.edgesAdded).toHaveLength(36);
    expect(diff.edgesRemoved).toHaveLength(12);
    expect(diff.edgesChanged).toEqual([]);
    expect(diff.netEdges).toBe(24);
    expect(diff.nodesAdded).toContain('creator_1');
    expect(diff.nodesAdded).toContain('income_register_3');
    expect(diff.edgesRemoved).toContain('kill>creator:KILL_PLANE_SIGNAL');
    expect(diff.edgesAdded).toContain('kill>creator_3:KILL_PLANE_SIGNAL');
  });

  it('identical files diff to zero; reversed diff swaps added/removed and negates the net', async () => {
    const same = await diffFiles(V3, V3);
    expect(same.diff).toEqual({
      nodesAdded: [], nodesRemoved: [], nodesChanged: [],
      edgesAdded: [], edgesRemoved: [], edgesChanged: [],
      netNodes: 0, netEdges: 0,
    });
    const rev = await diffFiles(V3, V2);
    expect(rev.diff.netNodes).toBe(-10);
    expect(rev.diff.netEdges).toBe(-24);
    expect(rev.diff.nodesAdded).toEqual(['content_selector', 'creator', 'creator_profile', 'drf', 'income_register']);
    expect(rev.diff.nodesRemoved).toHaveLength(15);
  });
});

describe('Phase 5 — pre-publish review', () => {
  it('v3 passes all gates; the diff gate is skipped without a baseline', async () => {
    const r = await reviewFile(V3);
    expect(r.ok).toBe(true);
    expect(r.nodes).toBe(39);
    expect(r.edges).toBe(67);
    expect(r.sha256).toBe(V3_SHA256);
    expect(r.gates.map((g) => [g.id, g.status])).toEqual([
      ['validation', 'pass'],
      ['stable-hash', 'pass'],
      ['image', 'pass'],
      ['diff', 'skip'],
    ]);
  });

  it('review --against v2 passes the diff gate with net +10 / +24', async () => {
    const r = await reviewFile(V3, { against: V2 });
    expect(r.ok).toBe(true);
    const diff = r.gates.find((g) => g.id === 'diff')!;
    expect(diff.status).toBe('pass');
    expect(diff.detail).toContain('+10');
    expect(diff.detail).toContain('+24');
  });

  it('review fails a broken project at the validation gate', async () => {
    const broken = JSON.parse(fs.readFileSync(V3, 'utf-8')) as { edges: { target: string }[] };
    broken.edges[0]!.target = 'missing-node';
    const p = path.join(tmp, 'broken.socroot.json');
    fs.writeFileSync(p, JSON.stringify(broken), 'utf-8');
    const r = await reviewFile(p);
    expect(r.ok).toBe(false);
    expect(r.gates.find((g) => g.id === 'validation')!.status).toBe('fail');
  });

  it('review --out persists the generated SVG', async () => {
    const outDir = path.join(tmp, 'review-out');
    const r = await reviewFile(V3, { outDir });
    expect(r.ok).toBe(true);
    const svgPath = path.join(outDir, 'influencers_system_v3.topology.svg');
    expect(fs.existsSync(svgPath)).toBe(true);
    expect(fs.readFileSync(svgPath, 'utf-8')).toContain('width="4175" height="2153"');
  });
});

describe('Phase 5 — export-image files', () => {
  it('SVG export writes a deterministic file', async () => {
    const a = path.join(tmp, 'v3-a.svg');
    const b = path.join(tmp, 'v3-b.svg');
    await exportImageFile(V3, a);
    await exportImageFile(V3, b);
    expect(sha256(a)).toBe(sha256(b));
    expect(fs.readFileSync(a, 'utf-8')).toContain('<svg');
  });

  it('rejects an unknown format and an extensionless output without --format', async () => {
    await expect(exportImageFile(V3, path.join(tmp, 'x.svg'), 'pdf')).rejects.toThrow('svg أو png');
    await expect(exportImageFile(V3, path.join(tmp, 'x'))).rejects.toThrow('--format');
  });

  it.skipIf(!hasChromium())('PNG export writes a 4175x2153 PNG', { timeout: 60000 }, async () => {
    const out = path.join(tmp, 'v3.png');
    const r = await exportImageFile(V3, out);
    expect(r.format).toBe('png');
    expect(fs.existsSync(out)).toBe(true);
    expect(fs.statSync(out).size).toBeGreaterThan(100_000);
    expect(pngSize(out)).toEqual({ width: 4175, height: 2153 });
  });
});

describe('Phase 5 — CLI wiring', () => {
  const tsx = path.join(ROOT, 'node_modules', '.bin', 'tsx');
  const run = (args: string[]) =>
    spawnSync(tsx, ['src/cli/index.ts', ...args], { cwd: ROOT, encoding: 'utf-8' });

  it('diff exits 0 and reports +10 / +24', { timeout: 30000 }, () => {
    const r = run(['diff', V2, V3]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('+10');
    expect(r.stdout).toContain('+24');
    expect(r.stdout).toContain('content_selector_1');
  });

  it('review exits 0 and reports ready; export-image exits 0', { timeout: 30000 }, () => {
    const r = run(['review', V3, '--against', V2]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('جاهز للنشر');
    const e = run(['export-image', V3, '--out', path.join(tmp, 'cli-v3.svg')]);
    expect(e.status).toBe(0);
    expect(e.stdout).toContain('SVG 4175x2153');
  });

  it('export-image without --out exits 1', { timeout: 30000 }, () => {
    const r = run(['export-image', V3]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('--out');
  });
});
