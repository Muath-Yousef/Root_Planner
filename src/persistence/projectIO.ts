import { validateDoc, type ValidationIssue } from '../schemas/validator';
import type { ProjectFile, SEdge, SNode } from '../types';
import { MigrationError, migrateProject } from './migrations';

/** Runtime-only fields React Flow adds; they must never be written to a project file. */
export const stripTransient = (nodes: SNode[]): SNode[] =>
  nodes.map((n) => { const { selected: _s, dragging: _d, measured: _m, ...rest } = n; return rest as SNode; });
export const stripEdges = (edges: SEdge[]): SEdge[] => edges.map((e) => { const { selected: _s, ...rest } = e; return rest as SEdge; });

export const serializeProject = (p: ProjectFile): string => JSON.stringify({ ...p, nodes: stripTransient(p.nodes), edges: stripEdges(p.edges) }, null, 2);

export type ParseResult =
  | { ok: true; project: ProjectFile; migrated_from: number | null }
  | { ok: false; code: string; message: string; issues: ValidationIssue[] };

/** Import path: JSON -> migrate to the current format -> Ajv validation. Never throws. */
export function parseProjectText(text: string): ParseResult {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch (e) { return { ok: false, code: 'BAD_JSON', message: `The file is not valid JSON: ${e instanceof Error ? e.message : String(e)}`, issues: [] }; }
  try {
    const { project, from_version } = migrateProject(raw);
    const issues = validateDoc('project', project);
    if (issues.length) return { ok: false, code: 'INVALID_PROJECT', message: `The project file has ${issues.length} problem(s). First: ${issues[0].message}`, issues };
    return { ok: true, project, migrated_from: from_version === project.format_version ? null : from_version };
  } catch (e) {
    if (e instanceof MigrationError) return { ok: false, code: e.code, message: e.message, issues: [] };
    throw e;
  }
}
