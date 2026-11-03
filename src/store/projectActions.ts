import { parseProjectText } from '../persistence/projectIO';
import { saveProject } from '../persistence/projectStore';
import type { ProjectFile } from '../types';
import { useStudio } from './useStudioStore';

/** Make a project the open one and persist it right away (so a reload restores it even before the first edit). */
export async function openProject(p: ProjectFile): Promise<void> { useStudio.getState().loadProject(p); await saveProject(p); }

export type ImportOutcome = { ok: true; migrated_from: number | null; project: ProjectFile } | { ok: false; message: string };
export async function importProjectFile(file: File): Promise<ImportOutcome> {
  const r = parseProjectText(await file.text());
  if (!r.ok) return { ok: false, message: r.message };
  await openProject(r.project);
  return { ok: true, migrated_from: r.migrated_from, project: r.project };
}
