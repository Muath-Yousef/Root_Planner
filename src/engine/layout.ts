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
