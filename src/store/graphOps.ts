import type { SEdge, SNode } from '../types';

export interface Clip { nodes: SNode[]; edges: SEdge[] }
export const selectedIds = (nodes: SNode[]): string[] => nodes.filter((n) => n.selected).map((n) => n.id);

/** Nodes plus every descendant (children of a zone go with the zone). */
export function withDescendants(nodes: SNode[], ids: Iterable<string>): Set<string> {
  const out = new Set(ids); let grew = true;
  while (grew) { grew = false; for (const n of nodes) if (n.parentId && out.has(n.parentId) && !out.has(n.id)) { out.add(n.id); grew = true; } }
  return out;
}
/** Copy keeps only the edges whose two ends are both copied. */
export function copyNodes(nodes: SNode[], edges: SEdge[], ids: string[]): Clip {
  const set = withDescendants(nodes, ids);
  return { nodes: structuredClone(nodes.filter((n) => set.has(n.id))), edges: structuredClone(edges.filter((e) => set.has(e.source) && set.has(e.target))) };
}
/**
 * Paste with fresh ids and an offset. A child whose parent zone was not copied loses `parentId`/`extent`
 * (its position was relative to that parent). Duplicated employees keep their contract ids, so the Problems
 * panel flags the duplicate until the user renames it.
 */
export function pasteClip(clip: Clip, offset: { x: number; y: number }, newId: (old: string) => string): { nodes: SNode[]; edges: SEdge[]; ids: string[] } {
  const map = new Map(clip.nodes.map((n) => [n.id, newId(n.id)]));
  const nodes = clip.nodes.map((n): SNode => {
    const parentKept = !!n.parentId && map.has(n.parentId);
    const { parentId: _p, extent: _x, ...rest } = n;
    const base = { ...rest, id: map.get(n.id)!, selected: true, position: parentKept ? n.position : { x: n.position.x + offset.x, y: n.position.y + offset.y } };
    return parentKept ? { ...base, parentId: map.get(n.parentId!), extent: 'parent' } : base;
  });
  const edges = clip.edges.map((e): SEdge => ({ ...e, id: `${e.id}~${map.get(e.source)}`, source: map.get(e.source)!, target: map.get(e.target)!, selected: false }));
  return { nodes, edges, ids: nodes.map((n) => n.id) };
}
export function removeNodes(nodes: SNode[], edges: SEdge[], ids: string[]): { nodes: SNode[]; edges: SEdge[] } {
  const gone = withDescendants(nodes, ids);
  return { nodes: nodes.filter((n) => !gone.has(n.id)), edges: edges.filter((e) => !gone.has(e.source) && !gone.has(e.target)) };
}
