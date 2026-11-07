import type { SEdge, SNode } from '../types';

/** Pure layout helpers: align, distribute and tidy. No React, no DOM. Positions of children are relative to their parent zone. */
export type AlignMode = 'left' | 'right' | 'top' | 'bottom' | 'hcenter' | 'vcenter';
export const ALIGN_MODES: AlignMode[] = ['left', 'right', 'top', 'bottom', 'hcenter', 'vcenter'];

const DEFAULT_W = 190, DEFAULT_H = 64, GAP_X = 90, GAP_Y = 30, ZONE_PAD_X = 28, ZONE_PAD_TOP = 44, ZONE_PAD_BOTTOM = 28;

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
export const sizeOf = (n: SNode): { w: number; h: number } => ({
  w: n.measured?.width ?? num(n.width) ?? num(n.style?.width) ?? DEFAULT_W,
  h: n.measured?.height ?? num(n.height) ?? num(n.style?.height) ?? DEFAULT_H,
});

/** Absolute position (parent chain added up). A cycle in parentId cannot happen in a valid graph, but the walk is bounded anyway. */
function absolute(n: SNode, byId: Map<string, SNode>): { x: number; y: number } {
  let x = n.position.x, y = n.position.y, cur = n, guard = 0;
  while (cur.parentId && guard++ < 16) { const p = byId.get(cur.parentId); if (!p) break; x += p.position.x; y += p.position.y; cur = p; }
  return { x, y };
}
const toRelative = (abs: { x: number; y: number }, n: SNode, byId: Map<string, SNode>) => {
  const p = n.parentId ? byId.get(n.parentId) : undefined;
  if (!p) return abs;
  const pa = absolute(p, byId);
  return { x: abs.x - pa.x, y: abs.y - pa.y };
};
const same = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x === b.x && a.y === b.y;

export function alignNodes(nodes: SNode[], ids: string[], mode: AlignMode): SNode[] {
  const pick = new Set(ids), byId = new Map(nodes.map((n) => [n.id, n]));
  const boxes = nodes.filter((n) => pick.has(n.id)).map((n) => ({ n, a: absolute(n, byId), s: sizeOf(n) }));
  if (boxes.length < 2) return nodes;
  const left = Math.min(...boxes.map((b) => b.a.x)), right = Math.max(...boxes.map((b) => b.a.x + b.s.w));
  const top = Math.min(...boxes.map((b) => b.a.y)), bottom = Math.max(...boxes.map((b) => b.a.y + b.s.h));
  const next = new Map<string, { x: number; y: number }>();
  for (const b of boxes) {
    const x = mode === 'left' ? left : mode === 'right' ? right - b.s.w : mode === 'hcenter' ? (left + right) / 2 - b.s.w / 2 : b.a.x;
    const y = mode === 'top' ? top : mode === 'bottom' ? bottom - b.s.h : mode === 'vcenter' ? (top + bottom) / 2 - b.s.h / 2 : b.a.y;
    next.set(b.n.id, toRelative({ x: Math.round(x), y: Math.round(y) }, b.n, byId));
  }
  return nodes.map((n) => { const p = next.get(n.id); return p && !same(p, n.position) ? { ...n, position: p } : n; });
}

/** Equal gaps between three or more nodes; the two outermost stay where they are. */
export function distributeNodes(nodes: SNode[], ids: string[], axis: 'x' | 'y'): SNode[] {
  const pick = new Set(ids), byId = new Map(nodes.map((n) => [n.id, n]));
  const boxes = nodes.filter((n) => pick.has(n.id)).map((n) => ({ n, a: absolute(n, byId), s: sizeOf(n) }));
  if (boxes.length < 3) return nodes;
  const k = axis, d = axis === 'x' ? 'w' : 'h';
  boxes.sort((p, q) => p.a[k] - q.a[k]);
  const first = boxes[0], last = boxes[boxes.length - 1];
  const span = last.a[k] + last.s[d] - first.a[k];
  const used = boxes.reduce((t, b) => t + b.s[d], 0);
  const gap = (span - used) / (boxes.length - 1);
  const next = new Map<string, { x: number; y: number }>();
  let cursor = first.a[k];
  for (const b of boxes) {
    const abs = { x: b.a.x, y: b.a.y }; abs[k] = Math.round(cursor); cursor += b.s[d] + gap;
    next.set(b.n.id, toRelative(abs, b.n, byId));
  }
  return nodes.map((n) => { const p = next.get(n.id); return p && !same(p, n.position) ? { ...n, position: p } : n; });
}

interface Item { id: string; w: number; h: number; x: number; y: number }

/** Longest-path layers over the edges that stay inside the group. Back edges (cycles) are ignored, so the result is deterministic. */
function layers(items: Item[], links: [string, string][]): Map<string, number> {
  const out = new Map<string, string[]>();
  for (const [a, b] of links) if (a !== b) out.set(a, [...(out.get(a) ?? []), b]);
  const layer = new Map<string, number>(), state = new Map<string, 1 | 2>();
  const visit = (id: string, depth: number) => {
    if (state.get(id) === 1) return; // on the current path: a back edge, ignored
    if ((layer.get(id) ?? -1) >= depth) return; // already at least this deep
    layer.set(id, depth); state.set(id, 1);
    for (const nx of out.get(id) ?? []) visit(nx, depth + 1);
    state.set(id, 2);
  };
  const hasIn = new Set(links.filter(([a, b]) => a !== b).map(([, b]) => b));
  for (const it of [...items].sort((p, q) => p.x - q.x || p.y - q.y)) if (!hasIn.has(it.id)) visit(it.id, 0);
  for (const it of items) if (!layer.has(it.id)) visit(it.id, 0);
  return layer;
}

/** Places items in columns (layers) from left to right, keeping the previous vertical order inside a column. */
function arrange(items: Item[], links: [string, string][], origin: { x: number; y: number }): void {
  if (items.length === 0) return;
  const lay = layers(items, links);
  const cols = new Map<number, Item[]>();
  for (const it of items) cols.set(lay.get(it.id) ?? 0, [...(cols.get(lay.get(it.id) ?? 0) ?? []), it]);
  let x = origin.x;
  for (const k of [...cols.keys()].sort((a, b) => a - b)) {
    const col = cols.get(k)!.sort((a, b) => a.y - b.y || a.x - b.x);
    let y = origin.y;
    for (const it of col) { it.x = x; it.y = y; y += it.h + GAP_Y; }
    x += Math.max(...col.map((i) => i.w)) + GAP_X;
  }
}

/**
 * Tidy layout. Zone children are arranged inside their zone and the zone is resized to fit; then the top level
 * (zones count as single blocks) is arranged left to right by the direction of the cables.
 */
export function autoLayout(nodes: SNode[], edges: SEdge[]): SNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const placed = new Map<string, { position: { x: number; y: number }; size?: { w: number; h: number } }>();
  const zoneOf = (id: string): string => { let n = byId.get(id); let guard = 0; while (n?.parentId && guard++ < 16) n = byId.get(n.parentId); return n?.id ?? id; };

  // 1. inside each zone
  const zones = nodes.filter((n) => n.data.kind === 'zone');
  const zoneSize = new Map<string, { w: number; h: number }>();
  for (const z of zones) {
    const kids = nodes.filter((n) => n.parentId === z.id && n.data.kind !== 'zone');
    if (kids.length === 0) { zoneSize.set(z.id, sizeOf(z)); continue; }
    const items: Item[] = kids.map((k) => ({ id: k.id, ...sizeOf(k), x: k.position.x, y: k.position.y }));
    const ids = new Set(kids.map((k) => k.id));
    arrange(items, edges.filter((e) => ids.has(e.source) && ids.has(e.target)).map((e): [string, string] => [e.source, e.target]), { x: ZONE_PAD_X, y: ZONE_PAD_TOP });
    for (const it of items) placed.set(it.id, { position: { x: it.x, y: it.y } });
    const w = Math.max(...items.map((i) => i.x + i.w)) + ZONE_PAD_X, h = Math.max(...items.map((i) => i.y + i.h)) + ZONE_PAD_BOTTOM;
    zoneSize.set(z.id, { w, h });
  }

  // 2. the top level
  const top = nodes.filter((n) => !n.parentId);
  const items: Item[] = top.map((n) => ({ id: n.id, ...(n.data.kind === 'zone' ? zoneSize.get(n.id) ?? sizeOf(n) : sizeOf(n)), x: n.position.x, y: n.position.y }));
  const topIds = new Set(top.map((n) => n.id));
  const links = edges.map((e): [string, string] => [zoneOf(e.source), zoneOf(e.target)]).filter(([a, b]) => topIds.has(a) && topIds.has(b));
  const origin = items.length ? { x: Math.min(...items.map((i) => i.x)), y: Math.min(...items.map((i) => i.y)) } : { x: 0, y: 0 };
  arrange(items, links, origin);
  for (const it of items) {
    const n = byId.get(it.id)!;
    placed.set(it.id, { position: { x: it.x, y: it.y }, size: n.data.kind === 'zone' ? { w: it.w, h: it.h } : undefined });
  }

  return nodes.map((n) => {
    const p = placed.get(n.id);
    if (!p) return n;
    const style = p.size ? { ...n.style, width: p.size.w, height: p.size.h } : n.style;
    return { ...n, position: { x: Math.round(p.position.x), y: Math.round(p.position.y) }, ...(style ? { style } : {}) };
  });
}

/* ------------------------------------------------------------------ *
 * Phase 2 — grid layout engine (lanes / rows, zone auto-sizing, edge
 * endpoint spreading). Pure and deterministic: same structure + same
 * parameters → same positions, every time. It does NOT replace
 * alignNodes / distributeNodes / autoLayout above; it is the engine the
 * DSL compiler calls so a designer declares structure (lane, row) instead
 * of hand-computing coordinates. See docs/LAYOUT.md.
 * ------------------------------------------------------------------ */

/**
 * The node footprint the grid engine sizes zones with: 200×64.
 * Provenance: the studio's own placement clamp assumes a 200-wide node
 * (`factoryPlacement.ts`: `b.w - 200`), and the picture renderer draws
 * nodes at NODE_W/NODE_H = 200/64. NOTE the older tidy helpers in this
 * file default to 190×64 (`sizeOf`); the two disagree, and the grid uses
 * 200 because it is the footprint that reproduces the delivered maps
 * (v3: 1920+200+40 = 2160, 680+64+40 = 784). Reconciling the two
 * defaults is a later-phase cleanup, not a silent change here.
 */
export const GRID_NODE_W = 200, GRID_NODE_H = 64;
/** The v3 grid: stage columns 320 apart, rows 170 apart, zone padding 40. */
export const GRID_STEP_X = 320, GRID_STEP_Y = 170, GRID_PAD = 40;
/** A stage step must at least fit one node plus the standard gap, or the
 *  manager gutter (stepX − node width − GAP_X) would go negative. */
export const GRID_MIN_STEP_X = GRID_NODE_W + GAP_X;

export interface GridParams { stepX: number; stepY: number; pad: number; }
export const DEFAULT_GRID_PARAMS: GridParams = { stepX: GRID_STEP_X, stepY: GRID_STEP_Y, pad: GRID_PAD };

/**
 * Grid cell → zone-relative position.
 *
 * Lanes are stage columns: lane k ≥ 1 sits at x = stepX × k. Lane 0 is the
 * manager gutter — the one manager who dispatches to every stage sits left
 * of the first stage, at x = stepX − node width − GAP_X, so the gap from
 * the manager's right edge to the first stage column is exactly the
 * standard GAP_X (320 − 200 − 90 = 30 in the v3 grid). Rows are uniform:
 * y = stepY × row. The rule is pure arithmetic: no edge traversal, no
 * dependence on node order.
 */
export function gridCellPosition(lane: number, row: number, params: GridParams = DEFAULT_GRID_PARAMS): { x: number; y: number } {
  const managerX = params.stepX - GRID_NODE_W - GAP_X;
  if (managerX < 0) {
    throw new Error(`gridCellPosition: خطوة الأعمدة stepX=${params.stepX} أصغر من ${GRID_MIN_STEP_X} — لا تتسع لعمود المدير (عرض العقدة ${GRID_NODE_W} + الفجوة ${GAP_X})`);
  }
  return { x: lane === 0 ? managerX : params.stepX * lane, y: params.stepY * row };
}

/**
 * Zone size from its children: the smallest box that contains every child
 * (at the grid footprint) plus `pad` on the right and bottom. For the v3
 * department zone this reproduces the manual size exactly (2160×784);
 * see docs/LAYOUT.md for the v1/v2 deltas, whose manual sizes carry extra
 * slack no single rule derives.
 */
export function zoneSizeFromChildren(
  children: ReadonlyArray<{ x: number; y: number }>,
  params: GridParams = DEFAULT_GRID_PARAMS,
): { w: number; h: number } {
  if (children.length === 0) throw new Error('zoneSizeFromChildren: لا أبناء لتحجيم المنطقة منهم');
  return {
    w: Math.max(...children.map((c) => c.x + GRID_NODE_W)) + params.pad,
    h: Math.max(...children.map((c) => c.y + GRID_NODE_H)) + params.pad,
  };
}

export interface EndpointOffsets { out: number; in: number; }

/** One step of the spread, clamped so a large fan never leaves the node. */
const spreadOffset = (rank: number, count: number): number =>
  Math.max(-26, Math.min(26, (rank - (count - 1) / 2) * 4));

/**
 * Edge-endpoint spreading, ported from the picture renderer's `_spread`
 * (same rule, same constants). Edges that share a source are ranked by
 * their target's absolute y; edges that share a target are ranked by
 * their source's absolute y; ties keep file order (explicit index
 * tiebreak, so the result does not depend on sort stability). The
 * returned array is index-aligned with `edges`: entry i holds the
 * vertical offsets (in node units) to apply to edge i's source endpoint
 * (`out`) and target endpoint (`in`). This is renderer data — it never
 * enters the .socroot.json file and never changes a cable's meaning.
 * NOTE the ±26 clamp: a fan of more than 13 edges shares the extreme
 * offsets (the manager's 20 dispatch edges collapse to 4 at −26 and 4
 * at +26); the middle edges still separate.
 */
export function edgeEndpointOffsets(nodes: SNode[], edges: SEdge[]): EndpointOffsets[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const absY = (id: string): number => { const n = byId.get(id); return n ? absolute(n, byId).y : 0; };
  const out: EndpointOffsets[] = edges.map(() => ({ out: 0, in: 0 }));
  const bySource = new Map<string, number[]>(), byTarget = new Map<string, number[]>();
  edges.forEach((e, i) => {
    bySource.set(e.source, [...(bySource.get(e.source) ?? []), i]);
    byTarget.set(e.target, [...(byTarget.get(e.target) ?? []), i]);
  });
  for (const idxs of bySource.values()) {
    const sorted = [...idxs].sort((a, b) => absY(edges[a]!.target) - absY(edges[b]!.target) || a - b);
    sorted.forEach((ei, rank) => { out[ei]!.out = spreadOffset(rank, sorted.length); });
  }
  for (const idxs of byTarget.values()) {
    const sorted = [...idxs].sort((a, b) => absY(edges[a]!.source) - absY(edges[b]!.source) || a - b);
    sorted.forEach((ei, rank) => { out[ei]!.in = spreadOffset(rank, sorted.length); });
  }
  return out;
}

export interface OverlapPair { a: string; b: string; }

/**
 * Overlapping node pairs, in absolute canvas coordinates. A zone and its
 * own descendants are containment, not overlap, and are skipped; every
 * other pair whose boxes intersect is reported (node order, so the result
 * is deterministic). Studio nodes use `sizeOf`; zones use their style
 * size (falling back to the factoryPlacement default 360×240).
 */
export function findOverlaps(nodes: SNode[]): OverlapPair[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const isAncestor = (anc: SNode, desc: SNode): boolean => {
    let cur = desc.parentId ? byId.get(desc.parentId) : undefined, guard = 0;
    while (cur && guard++ < 16) { if (cur.id === anc.id) return true; cur = cur.parentId ? byId.get(cur.parentId) : undefined; }
    return false;
  };
  const boxes = nodes.map((n) => {
    const a = absolute(n, byId);
    const s = n.data.kind === 'zone'
      ? { w: num(n.style?.width) ?? 360, h: num(n.style?.height) ?? 240 }
      : sizeOf(n);
    return { x: a.x, y: a.y, w: s.w, h: s.h };
  });
  const pairs: OverlapPair[] = [];
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i]!, b = nodes[j]!;
    if (isAncestor(a, b) || isAncestor(b, a)) continue;
    const A = boxes[i]!, B = boxes[j]!;
    if (A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h) pairs.push({ a: a.id, b: b.id });
  }
  return pairs;
}
