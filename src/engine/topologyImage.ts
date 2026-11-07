import { CABLE_DEFS } from '../registry/cables';
import { edgeEndpointOffsets } from './layout';
import type { CableKind, ProjectFile, SEdge, SNode } from '../types';

/**
 * Phase 5 — built-in topology image export (SVG).
 *
 * A pure, deterministic port of the verified external renderer
 * (`render_topology.py`, which drew the delivered v1/v2/v3 pictures) into
 * the repo's language. Same canvas geometry, same cable colours (read
 * from `CABLE_DEFS`, never copied), same rules: endpoint spreading from
 * `edgeEndpointOffsets` (Phase 2), labels only for the structure-carrying
 * cable kinds, a legend for statuses and cables.
 *
 * One deliberate difference: the Python renderer measures label widths
 * with real font metrics (PIL + Noto Sans Arabic / DejaVu). This module
 * runs without a font engine, so node auto-fit uses `estimateLabelWidth`
 * — a per-script advance table calibrated against the Python renderer's
 * measured widths for every label in v1/v2/v3 (worst box difference
 * 33px; every delivered label still fits inside its estimated box — see
 * `tests/export-review.test.ts`). In the SVG itself the browser (or the
 * headless Chromium used for PNG) does real font fallback per glyph, so
 * mixed Arabic/Latin strings need no run-splitting here.
 *
 * The SVG is deterministic: same project → same bytes. It carries no
 * timestamp. Positions come from the project file itself, never from
 * layout — this exporter draws what the file says.
 */

export const TOPOLOGY_SCALE = 1.25;
export const TOPOLOGY_NODE_W = 200;
export const TOPOLOGY_NODE_H = 64;
export const TOPOLOGY_PAD = 30;
export const TOPOLOGY_TITLE_H = 96;
export const TOPOLOGY_LEGEND_H = 152;

const BG = '#0b1220';
const PANEL = '#111c33';
const PANEL_EDGE = '#334155';
const TEXT = '#f1f5f9';
const MUTED = '#94a3b8';
const ZONE_FILL = '#1e293b';
const ZONE_EDGE = '#475569';
const FONT_STACK = "'Noto Sans Arabic','DejaVu Sans',sans-serif";

/** Status colours are the reference renderer's convention (the studio UI colours nodes by kind, not by status). */
export const STATUS_COLOR: Record<string, string> = { IMPLEMENTED: '#22c55e', PLANNED: '#f59e0b' };
export const STATUS_AR: Record<string, string> = { IMPLEMENTED: 'مبني ومقيس', PLANNED: 'مخطط، غير مبني' };

/** Short label drawn on the curve — structure-carrying kinds only (the legend covers the rest). */
export const CABLE_SHORT: Record<CableKind, string> = {
  OBJECTIVE_ROUTE: 'هدف',
  TASK_DISPATCH_RESULT: 'إسناد',
  ESCALATION_PATH: 'تصعيد',
  MEMORY_BUS: 'ذاكرة',
  EGRESS_NETWORK: 'خروج',
  KILL_PLANE_SIGNAL: 'إيقاف',
};
const LABEL_KINDS: ReadonlySet<CableKind> = new Set(['OBJECTIVE_ROUTE', 'ESCALATION_PATH', 'EGRESS_NETWORK']);

const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u060C\u061F]/;
const AR_MONTHS: Record<number, string> = {
  1: 'كانون الثاني', 2: 'شباط', 3: 'آذار', 4: 'نيسان', 5: 'أيار', 6: 'حزيران',
  7: 'تموز', 8: 'آب', 9: 'أيلول', 10: 'تشرين الأول', 11: 'تشرين الثاني', 12: 'كانون الأول',
};

/**
 * Estimated width of a node label at the label size (19px bold Arabic /
 * 18px bold Latin), in node units. Per-script advances calibrated against
 * the Python renderer's PIL measurements for the delivered labels.
 */
export function estimateLabelWidth(label: string): number {
  let w = 0;
  for (const ch of label) {
    if (ch === ' ') w += 5;
    else if (ch === '—') w += 18;
    else if (ch === '·') w += 9;
    else if (ARABIC_RE.test(ch)) w += 9.5;
    else if (ch >= 'A' && ch <= 'Z') w += 12.5;
    else if (ch >= 'a' && ch <= 'z') w += 10.5;
    else if (ch >= '0' && ch <= '9') w += 10.5;
    else w += 10;
  }
  return w;
}

/** Same estimator rescaled to another size / weight (used for legend text). */
function estimateTextWidth(text: string, sizePx: number, bold: boolean): number {
  return estimateLabelWidth(text) * (sizePx / 19) * (bold ? 1 : 0.94);
}

export interface NodeBox { x: number; y: number; w: number; h: number }
export interface TopologyGeometry {
  width: number;
  height: number;
  boxes: Map<string, NodeBox>;
}

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** Absolute position (parent chain added up) — same rule as `layout.ts`. */
function absolutePosition(n: SNode, byId: Map<string, SNode>): { x: number; y: number } {
  let x = n.position.x, y = n.position.y, cur = n, guard = 0;
  while (cur.parentId && guard++ < 16) {
    const p = byId.get(cur.parentId);
    if (!p) break;
    x += p.position.x;
    y += p.position.y;
    cur = p;
  }
  return { x, y };
}

function nodeBox(n: SNode, abs: { x: number; y: number }): NodeBox {
  if (n.data.kind === 'zone') {
    return {
      x: abs.x,
      y: abs.y,
      w: num(n.style?.width) ?? num(n.width) ?? 300,
      h: num(n.style?.height) ?? num(n.height) ?? 300,
    };
  }
  // Auto-fit long labels; cap so columns (320 apart) never touch.
  const w = Math.min(320, Math.max(TOPOLOGY_NODE_W, estimateLabelWidth(n.data.label) + 36));
  return { x: abs.x, y: abs.y, w, h: TOPOLOGY_NODE_H };
}

/** Canvas size and node boxes for a project — the geometry the SVG (and its tests) share. */
export function topologyGeometry(project: ProjectFile): TopologyGeometry {
  const byId = new Map(project.nodes.map((n) => [n.id, n]));
  const boxes = new Map<string, NodeBox>();
  for (const n of project.nodes) boxes.set(n.id, nodeBox(n, absolutePosition(n, byId)));
  const xs = [...boxes.values()].map((b) => b.x);
  const ys = [...boxes.values()].map((b) => b.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...[...boxes.values()].map((b) => b.x + b.w));
  const maxY = Math.max(...[...boxes.values()].map((b) => b.y + b.h));
  return {
    width: Math.floor((maxX - minX + 2 * TOPOLOGY_PAD) * TOPOLOGY_SCALE),
    height: Math.floor(TOPOLOGY_TITLE_H + (maxY - minY + 2 * TOPOLOGY_PAD) * TOPOLOGY_SCALE + TOPOLOGY_LEGEND_H),
    boxes,
  };
}

const fmt = (n: number): string => {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r);
};

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const cubicPoint = (
  p0: { x: number; y: number }, p1: { x: number; y: number },
  p2: { x: number; y: number }, p3: { x: number; y: number }, t: number,
): { x: number; y: number } => {
  const mt = 1 - t;
  return {
    x: mt ** 3 * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t ** 3 * p3.x,
    y: mt ** 3 * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t ** 3 * p3.y,
  };
};

interface EdgePath {
  id: string;
  kind: CableKind;
  d: string;
  label: { x: number; y: number; text: string } | null;
}

/** Cubic edge paths in canvas coordinates — the Python renderer's bezier rule, with Phase 2 spreading. */
function edgePaths(nodes: SNode[], edges: SEdge[], boxes: Map<string, NodeBox>, minX: number, minY: number): EdgePath[] {
  const offsets = edgeEndpointOffsets(nodes, edges);
  const X = (v: number): number => (v - minX + TOPOLOGY_PAD) * TOPOLOGY_SCALE;
  const Y = (v: number): number => TOPOLOGY_TITLE_H + (v - minY + TOPOLOGY_PAD) * TOPOLOGY_SCALE;
  return edges.map((e, i) => {
    const kind = e.data?.kind;
    if (kind === undefined) throw new Error(`الرابط ${e.id} بلا نوع كابل (data.kind) — لا يمكن رسمه`);
    const s = boxes.get(e.source);
    const t = boxes.get(e.target);
    if (s === undefined || t === undefined) {
      throw new Error(`الرابط ${e.id}: طرف مفقود (${e.source} → ${e.target}) — لا يمكن رسمه`);
    }
    const scx = s.x + s.w / 2, scy = s.y + s.h / 2;
    const tcx = t.x + t.w / 2, tcy = t.y + t.h / 2;
    const dx = tcx - scx, dy = tcy - scy;
    const outOff = offsets[i]!.out;
    const inOff = offsets[i]!.in;
    let p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number };
    if (Math.abs(dx) >= Math.abs(dy)) {
      const sgn = dx > 0 ? 1 : -1;
      p0 = dx > 0 ? { x: s.x + s.w, y: scy + outOff } : { x: s.x, y: scy + outOff };
      p3 = dx > 0 ? { x: t.x, y: tcy + inOff } : { x: t.x + t.w, y: tcy + inOff };
      const off = Math.max(50, Math.abs(dx) * 0.45);
      p1 = { x: p0.x + sgn * off, y: p0.y };
      p2 = { x: p3.x - sgn * off, y: p3.y };
    } else {
      const sgn = dy > 0 ? 1 : -1;
      p0 = dy > 0 ? { x: scx + outOff, y: s.y + s.h } : { x: scx + outOff, y: s.y };
      p3 = dy > 0 ? { x: tcx + inOff, y: t.y } : { x: tcx + inOff, y: t.y + t.h };
      const off = Math.max(50, Math.abs(dy) * 0.45);
      p1 = { x: p0.x, y: p0.y + sgn * off };
      p2 = { x: p3.x, y: p3.y - sgn * off };
    }
    const d = `M ${fmt(X(p0.x))} ${fmt(Y(p0.y))} C ${fmt(X(p1.x))} ${fmt(Y(p1.y))}, ${fmt(X(p2.x))} ${fmt(Y(p2.y))}, ${fmt(X(p3.x))} ${fmt(Y(p3.y))}`;
    const label = LABEL_KINDS.has(kind)
      ? (() => {
          const mid = cubicPoint(p0, p1, p2, p3, 2 / 3);
          return { x: X(mid.x), y: Y(mid.y) - 12, text: CABLE_SHORT[kind] };
        })()
      : null;
    return { id: e.id, kind, d, label };
  });
}

function dateText(createdAt: string): string {
  const dt = new Date(createdAt);
  if (Number.isNaN(dt.getTime())) return '';
  const month = AR_MONTHS[dt.getUTCMonth() + 1] ?? '';
  return `${dt.getUTCDate()} ${month} ${dt.getUTCFullYear()}`;
}

/** Renders a whole project as one self-contained SVG string (deterministic). */
export function renderTopologySvg(project: ProjectFile): string {
  const geo = topologyGeometry(project);
  const xs = [...geo.boxes.values()].map((b) => b.x);
  const ys = [...geo.boxes.values()].map((b) => b.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const X = (v: number): number => (v - minX + TOPOLOGY_PAD) * TOPOLOGY_SCALE;
  const Y = (v: number): number => TOPOLOGY_TITLE_H + (v - minY + TOPOLOGY_PAD) * TOPOLOGY_SCALE;
  const { width: W, height: H } = geo;

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT_STACK}">`);
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${BG}"/>`);

  // Arrowheads — one marker per cable kind (triangle: tip at the endpoint, base 11 back, half-width 5).
  parts.push('<defs>');
  for (const kind of Object.keys(CABLE_DEFS) as CableKind[]) {
    const color = CABLE_DEFS[kind].color;
    parts.push(`<marker id="arrow-${kind}" viewBox="0 0 11 10" refX="11" refY="5" markerWidth="11" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto"><path d="M 11 5 L 0 0 L 0 10 Z" fill="${color}"/></marker>`);
  }
  parts.push('</defs>');

  // Title from the project file itself.
  const title = project.name;
  const sub = `Root Planner · format v2 · ${project.horizon} · ${project.nodes.length} عقدة · ${project.edges.length} رابطاً · ${dateText(project.created_at)}`;
  parts.push(`<text x="${W - 28}" y="34" font-size="34" font-weight="700" fill="${TEXT}" text-anchor="end" dominant-baseline="central">${esc(title)}</text>`);
  parts.push(`<text x="${W - 28}" y="72" font-size="17" fill="${MUTED}" text-anchor="end" dominant-baseline="central">${esc(sub)}</text>`);
  parts.push(`<line x1="28" y1="${TOPOLOGY_TITLE_H - 14}" x2="${W - 28}" y2="${TOPOLOGY_TITLE_H - 14}" stroke="${PANEL_EDGE}" stroke-width="1"/>`);

  // Zones (behind everything).
  for (const n of project.nodes) {
    if (n.data.kind !== 'zone') continue;
    const b = geo.boxes.get(n.id)!;
    parts.push(`<g data-node="${esc(n.id)}"><rect x="${fmt(X(b.x))}" y="${fmt(Y(b.y))}" width="${fmt(b.w * TOPOLOGY_SCALE)}" height="${fmt(b.h * TOPOLOGY_SCALE)}" rx="14" fill="${ZONE_FILL}" fill-opacity="0.55" stroke="${ZONE_EDGE}" stroke-width="2"/><text x="${fmt(X(b.x) + 16)}" y="${fmt(Y(b.y) + 18)}" font-size="16" font-weight="700" fill="${MUTED}" text-anchor="start" dominant-baseline="central">${esc(n.data.label)}</text></g>`);
  }

  // Edges (bezier, studio cable colours + dash patterns).
  for (const p of edgePaths(project.nodes, project.edges, geo.boxes, minX, minY)) {
    const def = CABLE_DEFS[p.kind];
    const dash = def.dashArray
      ? ` stroke-dasharray="${def.dashArray.split(/\s+/).map((d) => fmt(Number(d) * TOPOLOGY_SCALE)).join(' ')}"`
      : '';
    parts.push(`<path data-edge="${esc(p.id)}" data-kind="${p.kind}" d="${p.d}" fill="none" stroke="${def.color}" stroke-width="3"${dash} marker-end="url(#arrow-${p.kind})"/>`);
    if (p.label) {
      parts.push(`<text x="${fmt(p.label.x)}" y="${fmt(p.label.y)}" font-size="12" fill="${def.color}" text-anchor="middle" dominant-baseline="central">${esc(p.label.text)}</text>`);
    }
  }

  // Nodes.
  for (const n of project.nodes) {
    if (n.data.kind === 'zone') continue;
    const b = geo.boxes.get(n.id)!;
    const x0 = X(b.x), y0 = Y(b.y), x1 = X(b.x + b.w), y1 = Y(b.y + b.h);
    const status = n.data.status;
    const scol = STATUS_COLOR[status] ?? MUTED;
    const cx = (x0 + x1) / 2;
    parts.push(`<g data-node="${esc(n.id)}">`);
    parts.push(`<rect x="${fmt(x0)}" y="${fmt(y0)}" width="${fmt(x1 - x0)}" height="${fmt(y1 - y0)}" rx="12" fill="${PANEL}" stroke="${PANEL_EDGE}" stroke-width="1"/>`);
    parts.push(`<line x1="${fmt(x0 + 12)}" y1="${fmt(y0)}" x2="${fmt(x1 - 12)}" y2="${fmt(y0)}" stroke="${scol}" stroke-width="4"/>`);
    parts.push(`<text x="${fmt(cx)}" y="${fmt(y0 + 24)}" font-size="19" font-weight="700" fill="${TEXT}" text-anchor="middle" dominant-baseline="central">${esc(n.data.label)}</text>`);
    parts.push(`<text x="${fmt(cx)}" y="${fmt(y0 + 48)}" font-size="13" fill="${MUTED}" text-anchor="middle" dominant-baseline="central">${esc(`${n.data.role} · ${n.data.kind}`)}</text>`);
    parts.push(`<text x="${fmt(cx)}" y="${fmt(y0 + 67)}" font-size="12" fill="${scol}" text-anchor="middle" dominant-baseline="central">${esc(`${STATUS_AR[status] ?? status} — ${status}`)}</text>`);
    parts.push('</g>');
  }
  // Legend: cables in two rows of three (right side), status chips and the note (left side).
  const ly = H - TOPOLOGY_LEGEND_H + 16;
  parts.push(`<text x="${W - 28}" y="${ly}" font-size="16" font-weight="700" fill="${TEXT}" text-anchor="end" dominant-baseline="central">مفتاح الخريطة</text>`);
  const rowX = [W - 28, W - 28];
  (Object.keys(CABLE_DEFS) as CableKind[]).forEach((kind, i) => {
    const def = CABLE_DEFS[kind];
    const r = Math.floor(i / 3);
    const y = ly + 30 + r * 26;
    const x2 = rowX[r]!;
    const x1 = x2 - 46;
    parts.push(`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${def.color}" stroke-width="4"/>`);
    const text = `${def.label.ar}  ·  ${kind}`;
    parts.push(`<text x="${x1 - 10}" y="${y}" font-size="14" fill="${MUTED}" text-anchor="end" dominant-baseline="central">${esc(text)}</text>`);
    rowX[r] = x1 - 10 - estimateTextWidth(text, 14, false) * 1.15 - 26;
  });
  let x = 28;
  const y2 = ly + 84;
  for (const st of Object.keys(STATUS_COLOR)) {
    const col = STATUS_COLOR[st]!;
    parts.push(`<circle cx="${x + 6}" cy="${y2}" r="6" fill="${col}"/>`);
    const text = `${st} — ${STATUS_AR[st]}`;
    parts.push(`<text x="${x + 20}" y="${y2}" font-size="14" fill="${TEXT}" text-anchor="start" dominant-baseline="central">${esc(text)}</text>`);
    x += 20 + estimateTextWidth(text, 14, false) * 1.15 + 44;
  }
  parts.push(`<text x="28" y="${ly + 112}" font-size="13" fill="${MUTED}" text-anchor="start" dominant-baseline="central">العقد والروابط والمواضع من الملف نفسه، والرسم مطابق لما يرسمه الاستوديو.</text>`);
  parts.push('</svg>');
  return parts.join('\n');
}
