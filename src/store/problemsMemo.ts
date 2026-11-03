import type { Problem } from '../engine/problems';
import type { SEdge, SNode } from '../types';

/**
 * Problems only depend on node ids/data/parents, edges and the tenant, never on positions. While a node is dragged only its
 * position changes (its `data` reference stays), so the cached list is reused and Ajv does not run on every mouse move.
 */
export function createProblemsMemo(compute: (nodes: SNode[], edges: SEdge[], tenant_id: string) => Problem[]) {
  let last: { n: SNode[]; e: SEdge[]; t: string; p: Problem[] } | null = null;
  const same = (a: SNode[], b: SNode[]) => a === b || (a.length === b.length && a.every((x, i) => x.id === b[i].id && x.data === b[i].data && x.parentId === b[i].parentId));
  return (nodes: SNode[], edges: SEdge[], tenant_id: string): Problem[] => {
    if (last && last.e === edges && last.t === tenant_id && same(last.n, nodes)) return last.p;
    last = { n: nodes, e: edges, t: tenant_id, p: compute(nodes, edges, tenant_id) };
    return last.p;
  };
}
