/** Undo/Redo as snapshots of the graph. Snapshots share structure with the live arrays, so they are cheap. Pure. */
export interface Snapshot<N, E> { nodes: N[]; edges: E[] }
export interface History<N, E> { past: Snapshot<N, E>[]; future: Snapshot<N, E>[] }
export const HISTORY_LIMIT = 100;
export const emptyHistory = <N, E>(): History<N, E> => ({ past: [], future: [] });

/** Record the state BEFORE a change. Any new change invalidates the redo stack. */
export function pushSnapshot<N, E>(h: History<N, E>, snap: Snapshot<N, E>, limit = HISTORY_LIMIT): History<N, E> {
  const past = [...h.past, snap];
  return { past: past.length > limit ? past.slice(past.length - limit) : past, future: [] };
}
export function undo<N, E>(h: History<N, E>, current: Snapshot<N, E>): { history: History<N, E>; snapshot: Snapshot<N, E> } | null {
  const prev = h.past.at(-1);
  return prev ? { snapshot: prev, history: { past: h.past.slice(0, -1), future: [...h.future, current] } } : null;
}
export function redo<N, E>(h: History<N, E>, current: Snapshot<N, E>): { history: History<N, E>; snapshot: Snapshot<N, E> } | null {
  const next = h.future.at(-1);
  return next ? { snapshot: next, history: { past: [...h.past, current], future: h.future.slice(0, -1) } } : null;
}
