import type { ProjectFile } from '../types';

/**
 * Phase 5 — diff between two project versions.
 *
 * Lists added / removed / changed nodes and edges precisely (no «تغيّر
 * شيء ما»). Identity is the node/edge id; «changed» means the same id
 * with different content — position, parent, data or style — compared by
 * a canonical (key-sorted) JSON serialisation, so key order in the file
 * can never report a false change. Lists are sorted, so the output is
 * deterministic.
 */

export interface ProjectDiff {
  nodesAdded: string[];
  nodesRemoved: string[];
  nodesChanged: string[];
  edgesAdded: string[];
  edgesRemoved: string[];
  edgesChanged: string[];
  /** b.nodes − a.nodes (signed). */
  netNodes: number;
  /** b.edges − a.edges (signed). */
  netEdges: number;
}

const stableStringify = (v: unknown): string => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const obj = v as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
};

export function diffProjects(a: ProjectFile, b: ProjectFile): ProjectDiff {
  const aNodes = new Map(a.nodes.map((n) => [n.id, n]));
  const bNodes = new Map(b.nodes.map((n) => [n.id, n]));
  const aEdges = new Map(a.edges.map((e) => [e.id, e]));
  const bEdges = new Map(b.edges.map((e) => [e.id, e]));
  const sort = (xs: string[]): string[] => [...xs].sort();
  const nodesAdded = sort([...bNodes.keys()].filter((id) => !aNodes.has(id)));
  const nodesRemoved = sort([...aNodes.keys()].filter((id) => !bNodes.has(id)));
  const nodesChanged = sort(
    [...aNodes.keys()].filter((id) => bNodes.has(id) && stableStringify(aNodes.get(id)) !== stableStringify(bNodes.get(id))),
  );
  const edgesAdded = sort([...bEdges.keys()].filter((id) => !aEdges.has(id)));
  const edgesRemoved = sort([...aEdges.keys()].filter((id) => !bEdges.has(id)));
  const edgesChanged = sort(
    [...aEdges.keys()].filter((id) => bEdges.has(id) && stableStringify(aEdges.get(id)) !== stableStringify(bEdges.get(id))),
  );
  return {
    nodesAdded, nodesRemoved, nodesChanged,
    edgesAdded, edgesRemoved, edgesChanged,
    netNodes: b.nodes.length - a.nodes.length,
    netEdges: b.edges.length - a.edges.length,
  };
}

const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));

const list = (title: string, ids: string[]): string =>
  ids.length === 0 ? `  ${title}: —` : `  ${title} (${ids.length}): ${ids.join('، ')}`;

/** Arabic rendering of a diff for the CLI (summary first, then the lists). */
export function formatProjectDiff(diff: ProjectDiff, aName: string, bName: string): string {
  const lines = [
    `الفرق: ${aName} ← ${bName}`,
    `  العقد: ${signed(diff.netNodes)} صافياً (أُضيفت ${diff.nodesAdded.length}، حُذفت ${diff.nodesRemoved.length}، تغيّرت ${diff.nodesChanged.length})`,
    `  الروابط: ${signed(diff.netEdges)} صافياً (أُضيفت ${diff.edgesAdded.length}، حُذفت ${diff.edgesRemoved.length}، تغيّرت ${diff.edgesChanged.length})`,
    list('عقد أُضيفت', diff.nodesAdded),
    list('عقد حُذفت', diff.nodesRemoved),
    list('عقد تغيّرت', diff.nodesChanged),
    list('روابط أُضيفت', diff.edgesAdded),
    list('روابط حُذفت', diff.edgesRemoved),
    list('روابط تغيّرت', diff.edgesChanged),
  ];
  return lines.join('\n');
}
