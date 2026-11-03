import { CURRENT_FORMAT_VERSION } from '../schemas/project';
import { defaultConfigs } from '../presets/defaultConfigs';
import { tenantProfile } from '../presets/tenantProfiles';
import type { ProjectFile } from '../types';

export type MigrationErrorCode = 'NOT_AN_OBJECT' | 'NOT_SOCROOT_FILE' | 'MISSING_VERSION' | 'FUTURE_VERSION' | 'NO_MIGRATION_PATH';
export class MigrationError extends Error {
  constructor(readonly code: MigrationErrorCode, message: string) { super(message); this.name = 'MigrationError'; }
}

/** A raw, not-yet-validated project document. Only the shape needed to move it forward is touched. */
type Raw = Record<string, unknown>;
type Step = (doc: Raw) => Raw;

const isObj = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project';

/**
 * v1 -> v2 (docs/REFERENCE_GAPS.md G-11: the v1 shape is the studio's own earlier format and is not defined by the reference).
 * v1 stored `tenant_id` as a plain string and had no `app`, `id`, `horizon`, `configs` or timestamps; nodes could lack `status`.
 */
const v1ToV2: Step = (doc) => {
  const tenantId = typeof doc.tenant_id === 'string' && doc.tenant_id ? doc.tenant_id : 'socroot-core';
  const profile = tenantProfile(tenantId);
  const name = typeof doc.name === 'string' && doc.name ? doc.name : 'Imported project';
  const now = new Date().toISOString();
  const nodes = (Array.isArray(doc.nodes) ? doc.nodes : []).map((n) => {
    if (!isObj(n) || !isObj(n.data)) return n;
    return { ...n, data: { status: 'IMPLEMENTED', ...n.data } };
  });
  const edges = (Array.isArray(doc.edges) ? doc.edges : []).map((e) => (isObj(e) && e.type === undefined ? { ...e, type: 'protocol' } : e));
  const { tenant_id: _dropped, ...rest } = doc;
  return {
    ...rest, format_version: 2, app: 'socroot-topology-studio',
    id: typeof doc.id === 'string' && doc.id ? doc.id : `imported-${slug(name)}`, name,
    tenant: { tenant_id: tenantId, isolation: profile?.isolation ?? 'logical_rls', name: profile?.name ?? tenantId },
    horizon: doc.horizon ?? 'CURRENT',
    created_at: typeof doc.created_at === 'string' ? doc.created_at : now, updated_at: now,
    nodes, edges, configs: isObj(doc.configs) ? { ...defaultConfigs(), ...doc.configs } : defaultConfigs(),
  };
};

/** One function per version hop, keyed by the version it upgrades FROM. Add `2: v2ToV3` when the format changes. */
export const MIGRATIONS: Record<number, Step> = { 1: v1ToV2 };

export interface MigrationResult { project: ProjectFile; from_version: number; steps: number[] }

export function migrateProject(raw: unknown): MigrationResult {
  if (!isObj(raw)) throw new MigrationError('NOT_AN_OBJECT', 'The file is not a project document.');
  if (typeof raw.format_version !== 'number' || !Number.isInteger(raw.format_version) || raw.format_version < 1)
    throw new MigrationError('MISSING_VERSION', 'The file has no valid format_version, so it cannot be upgraded safely.');
  if (raw.app !== undefined && raw.app !== 'socroot-topology-studio') throw new MigrationError('NOT_SOCROOT_FILE', 'This file was not created by socroot-topology-studio.');
  const from = raw.format_version;
  if (from > CURRENT_FORMAT_VERSION) throw new MigrationError('FUTURE_VERSION', `The file uses format ${from}; this studio reads up to ${CURRENT_FORMAT_VERSION}. Update the studio to open it.`);
  let doc: Raw = raw; const steps: number[] = [];
  for (let v = from; v < CURRENT_FORMAT_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) throw new MigrationError('NO_MIGRATION_PATH', `No migration from format ${v} to ${v + 1}.`);
    doc = { ...step(doc), format_version: v + 1 }; steps.push(v);
  }
  return { project: doc as unknown as ProjectFile, from_version: from, steps };
}
