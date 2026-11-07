import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { load as loadYaml } from 'js-yaml';
import { compileTopology } from '../dsl/compiler';
import type { RoleDefinition } from '../registry';
import { checkCable } from '../engine/cablingValidator';
import { collectProblems } from '../engine/problems';
import { parseProjectText, serializeProject } from '../persistence/projectIO';
import type { ProjectFile } from '../types';

/**
 * Phase 4 — headless CLI commands (validate / build / export).
 *
 * These functions are the testable core behind `src/cli/index.ts` (the
 * argv entry). They call the same engine functions the studio UI calls —
 * parseProjectText / checkCable / collectProblems for validation and the
 * DSL compiler for builds — so the CLI can never drift from the app: no
 * duplicated logic, no parallel validator.
 *
 * Determinism: `build` of a YAML spec whose `created_at` is pinned (the
 * v3 example pins it) reproduces the delivered file byte-identically;
 * `--now` overrides the timestamp for specs that do not pin one.
 */

export interface ValidationReport {
  file: string;
  /** True when there are zero errors. Warnings do not fail validation. */
  ok: boolean;
  errors: string[];
  warnings: string[];
  nodes: number;
  edges: number;
}

export interface BuildResult {
  outPath: string;
  sha256: string;
  nodes: number;
  edges: number;
}

const isYaml = (p: string): boolean => /\.ya?ml$/i.test(p);

/** The studio's own validation, run over an already-loaded project. */
export function validateProject(project: ProjectFile, file: string): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byId = new Map(project.nodes.map((n) => [n.id, n]));
  for (const e of project.edges) {
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    if (s === undefined || t === undefined) {
      errors.push(`الرابط ${e.id}: طرف مفقود (${e.source} → ${e.target})`);
      continue;
    }
    const r = checkCable(s, t, e.data?.kind, e.data?.access);
    if (!r.verdict.ok) errors.push(`الرابط ${e.id}: ${r.verdict.reason}`);
  }
  for (const p of collectProblems(project.nodes, project.edges, { tenant_id: project.tenant.tenant_id })) {
    (p.severity === 'error' ? errors : warnings).push(`${p.code}: ${p.message}`);
  }
  return { file, ok: errors.length === 0, errors, warnings, nodes: project.nodes.length, edges: project.edges.length };
}

/** The `roles.source` file reference of a YAML spec, if it declares one. */
function rolesSourceOf(yamlText: string): string | undefined {
  let raw: unknown;
  try {
    raw = loadYaml(yamlText);
  } catch {
    return undefined;
  }
  if (typeof raw !== 'object' || raw === null) return undefined;
  const roles = (raw as Record<string, unknown>).roles;
  if (typeof roles !== 'object' || roles === null) return undefined;
  const source = (roles as Record<string, unknown>).source;
  return typeof source === 'string' ? source : undefined;
}

/**
 * Loads the custom role definitions a YAML spec points at. The path is
 * resolved relative to the repository root first, then relative to the
 * spec's own directory. The file must default-export a RoleDefinition
 * array (every entry with a string id) — the installed
 * `src/registry/roles/influencer.ts` is the example.
 */
export async function loadCustomRoles(source: string, specDir: string): Promise<RoleDefinition[]> {
  const candidates = [path.resolve(source), path.resolve(specDir, source)];
  const resolved = candidates.find((c) => fs.existsSync(c));
  if (resolved === undefined) {
    throw new Error(`ملف الأدوار المخصصة "${source}" غير موجود — جُرّب: ${candidates.join('، ')}`);
  }
  const mod = (await import(pathToFileURL(resolved).href)) as { default?: unknown };
  const defs = mod.default;
  if (!Array.isArray(defs) || defs.some((d) => typeof d !== 'object' || d === null || typeof (d as { id: unknown }).id !== 'string')) {
    throw new Error(`ملف الأدوار "${source}" يجب أن يصدّر افتراضياً قائمة RoleDefinition (كل عنصر له id نصي)`);
  }
  return defs as RoleDefinition[];
}

/** Loads a project from a .socroot.json or a YAML spec — throws on any failure. */
export async function loadProject(input: string): Promise<ProjectFile> {
  const text = fs.readFileSync(input, 'utf-8');
  if (isYaml(input)) {
    const source = rolesSourceOf(text);
    const customRoles = source !== undefined ? await loadCustomRoles(source, path.dirname(path.resolve(input))) : undefined;
    return compileTopology(text, customRoles !== undefined ? { customRoles } : {});
  }
  const parsed = parseProjectText(text);
  if (!parsed.ok) {
    throw new Error(`${parsed.code}: ${parsed.message}`);
  }
  return parsed.project;
}

/** Validates a .socroot.json or YAML file with the studio's own checks. Never throws. */
export async function validateFile(filePath: string): Promise<ValidationReport> {
  let project: ProjectFile;
  try {
    project = await loadProject(filePath);
  } catch (e) {
    return { file: filePath, ok: false, errors: [e instanceof Error ? e.message : String(e)], warnings: [], nodes: 0, edges: 0 };
  }
  return validateProject(project, filePath);
}

const writeProject = (project: ProjectFile, outPath: string): BuildResult => {
  const bytes = `${serializeProject(project)}\n`;
  fs.writeFileSync(outPath, bytes, 'utf-8');
  return { outPath, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), nodes: project.nodes.length, edges: project.edges.length };
};

/**
 * Compiles a YAML spec to a .socroot.json. Without `--out` the output
 * sits next to the spec with the same basename (`spec.yaml` →
 * `spec.socroot.json`). Without `--now` the spec's own `created_at` is
 * used when pinned; otherwise the current time is used (non-deterministic
 * — pass `--now` for a reproducible build).
 */
export async function buildFile(inputYaml: string, opts: { out?: string; now?: string } = {}): Promise<BuildResult> {
  if (!isYaml(inputYaml)) throw new Error(`build يقبل ملف YAML فقط — الملف المعطى: ${inputYaml}`);
  const text = fs.readFileSync(inputYaml, 'utf-8');
  const source = rolesSourceOf(text);
  const customRoles = source !== undefined ? await loadCustomRoles(source, path.dirname(path.resolve(inputYaml))) : undefined;
  const project = compileTopology(text, {
    ...(customRoles !== undefined ? { customRoles } : {}),
    ...(opts.now !== undefined ? { now: opts.now } : {}),
  });
  return writeProject(project, opts.out ?? inputYaml.replace(/\.ya?ml$/i, '.socroot.json'));
}

/**
 * Writes a validated, canonical copy of a project to a chosen path.
 * Accepts a .socroot.json or a YAML spec; refuses to export a project
 * that fails validation, naming the first error.
 */
export async function exportFile(input: string, outPath: string): Promise<BuildResult> {
  const report = await validateFile(input);
  if (!report.ok) {
    throw new Error(`لا يمكن تصدير ${input}: ${report.errors.length} خطأ — أولها: ${report.errors[0]}`);
  }
  const project = await loadProject(input);
  return writeProject(project, outPath);
}
