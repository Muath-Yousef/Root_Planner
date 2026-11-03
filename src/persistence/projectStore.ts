import { del, get, set } from 'idb-keyval';
import type { ProjectFile } from '../types';
import { migrateProject } from './migrations';

/** Several companies/projects live side by side in IndexedDB: one index record plus one record per project. */
export interface ProjectSummary { id: string; name: string; tenant_id: string; updated_at: string }
const INDEX = 'socroot:index', LAST = 'socroot:last', key = (id: string) => `socroot:project:${id}`;

export async function listProjects(): Promise<ProjectSummary[]> {
  const idx = (await get<ProjectSummary[]>(INDEX)) ?? [];
  return [...idx].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}
export async function saveProject(p: ProjectFile): Promise<void> {
  const next: ProjectFile = { ...p, updated_at: new Date().toISOString() };
  await set(key(p.id), next);
  const idx = ((await get<ProjectSummary[]>(INDEX)) ?? []).filter((s) => s.id !== p.id);
  idx.push({ id: p.id, name: p.name, tenant_id: p.tenant.tenant_id, updated_at: next.updated_at });
  await set(INDEX, idx); await set(LAST, p.id);
}
/** Stored records may come from an older studio version, so they pass through the same migration as imports. */
export async function loadProject(id: string): Promise<ProjectFile | null> {
  const raw = await get<unknown>(key(id));
  return raw === undefined ? null : migrateProject(raw).project;
}
export async function deleteProject(id: string): Promise<void> {
  await del(key(id));
  await set(INDEX, ((await get<ProjectSummary[]>(INDEX)) ?? []).filter((s) => s.id !== id));
  if ((await get<string>(LAST)) === id) await del(LAST);
}
export const lastProjectId = (): Promise<string | undefined> => get<string>(LAST);
