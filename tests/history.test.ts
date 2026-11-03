import { describe, expect, it } from 'vitest';
import { emptyHistory, pushSnapshot, redo, undo, HISTORY_LIMIT } from '../src/store/history';
import { copyNodes, pasteClip, removeNodes, withDescendants } from '../src/store/graphOps';
import type { SEdge, SNode } from '../src/types';

const snap = (n: number) => ({ nodes: [n], edges: [] as number[] });
describe('undo/redo history', () => {
  it('undo restores the previous state and redo returns to it', () => {
    let h = pushSnapshot(emptyHistory<number, number>(), snap(1));
    const u = undo(h, snap(2))!; expect(u.snapshot).toEqual(snap(1)); h = u.history;
    const r = redo(h, snap(1))!; expect(r.snapshot).toEqual(snap(2));
  });
  it('a new change clears the redo stack and an empty history cannot undo', () => {
    let h = pushSnapshot(emptyHistory<number, number>(), snap(1));
    h = undo(h, snap(2))!.history; expect(h.future).toHaveLength(1);
    h = pushSnapshot(h, snap(3)); expect(h.future).toHaveLength(0);
    expect(undo(emptyHistory<number, number>(), snap(1))).toBeNull(); expect(redo(emptyHistory<number, number>(), snap(1))).toBeNull();
  });
  it('is bounded', () => {
    let h = emptyHistory<number, number>(); for (let i = 0; i < HISTORY_LIMIT + 25; i++) h = pushSnapshot(h, snap(i));
    expect(h.past).toHaveLength(HISTORY_LIMIT); expect(h.past[0]).toEqual(snap(25));
  });
});

const N = (id: string, extra: Partial<SNode> = {}): SNode => ({ id, position: { x: 0, y: 0 }, data: { label: id, kind: 'employee', role: 'scout', status: 'IMPLEMENTED' }, ...extra });
const E = (id: string, source: string, target: string): SEdge => ({ id, source, target, data: { kind: 'TASK_DISPATCH_RESULT' } });
describe('graph operations', () => {
  const nodes = [N('zone'), N('a', { parentId: 'zone' }), N('b'), N('c')];
  const edges = [E('e1', 'a', 'b'), E('e2', 'b', 'c')];
  it('a zone brings its children', () => expect([...withDescendants(nodes, ['zone'])].sort()).toEqual(['a', 'zone']));
  it('copy keeps only edges between copied nodes; paste gives new ids and an offset', () => {
    const clip = copyNodes(nodes, edges, ['a', 'b']);
    expect(clip.edges.map((e) => e.id)).toEqual(['e1']);
    const p = pasteClip(clip, { x: 40, y: 40 }, (o) => `${o}-copy`);
    expect(p.nodes.map((n) => n.id)).toEqual(['a-copy', 'b-copy']);
    expect(p.nodes[1].position).toEqual({ x: 40, y: 40 });
    expect(p.nodes[0].parentId).toBeUndefined();               // parent zone was not copied
    expect(p.edges[0]).toMatchObject({ source: 'a-copy', target: 'b-copy' });
  });
  it('remove deletes descendants and touching edges', () => {
    const r = removeNodes(nodes, edges, ['zone', 'b']);
    expect(r.nodes.map((n) => n.id)).toEqual(['c']); expect(r.edges).toHaveLength(0);
  });
});
