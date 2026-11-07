import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { listRoles } from '../registry';
import type { RoleDefinition } from '../registry';

/**
 * Phase 4b — `roles register <file>`: the studio's own extension point,
 * automated. The repo files are the persistence: one RoleDefinition file
 * in src/registry/roles/ + an import and a registerRoles call in
 * src/registry/index.ts. No runtime registry, no manifest file, no new
 * mechanism — this command only performs the two edits the Phase 4 agent
 * did by hand, after validating the definitions and verifying (in a fresh
 * process) that getRole resolves the new role(s).
 *
 * Fail-closed throughout: an invalid definition, a conflicting id, an
 * unexpected index.ts shape or a failed verification refuses with an
 * Arabic error and leaves the tree untouched (a copy made before a failed
 * verification is removed again).
 */

export const NODE_KINDS = ['founder', 'orchestrator', 'manager', 'employee', 'guard', 'memory', 'external', 'zone'] as const;
export const HORIZONS = ['CURRENT', 'TRANSITIONAL', 'TARGET'] as const;
export const IMPLEMENTATION_STATUSES = ['IMPLEMENTED', 'PARTIAL', 'PLANNED', 'TRIGGER_BASED', 'DEPRECATED'] as const;
export const INSPECTOR_TABS = ['identity', 'contract', 'manifest', 'code', 'tools', 'policies', 'context'] as const;
export const NETWORK_MODES = ['internal', 'isolated', 'none'] as const;
export const MEMORY_TIERS = ['L1', 'L2', 'L3', 'L4'] as const;
export const CABLE_KINDS = ['OBJECTIVE_ROUTE', 'TASK_DISPATCH_RESULT', 'ESCALATION_PATH', 'MEMORY_BUS', 'EGRESS_NETWORK', 'KILL_PLANE_SIGNAL'] as const;
export const ZONE_KINDS = ['meta', 'line', 'docker', 'untrusted'] as const;
export const DEPARTMENT_CLASSES = ['OPERATIONAL_META', 'FUNCTIONAL_LINE'] as const;

/** Every role id already registered in this studio matches this shape. */
const ID_RE = /^[a-z][a-z0-9_]*$/;
/** A role file must yield a valid TypeScript identifier for its import. */
const BASENAME_RE = /^[A-Za-z][A-Za-z0-9_-]*$/;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((s) => typeof s === 'string');
const isNonEmptyStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.length > 0 && v.every((s) => isNonEmptyString(s));

/** Structural equality (key-order-insensitive) — mirrors the helper in
 *  src/dsl/compiler.ts, kept local so the compiler stays untouched. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const ka = Object.keys(ra);
  const kb = Object.keys(rb);
  return ka.length === kb.length && ka.every((k) => deepEqual(ra[k], rb[k]));
}

function roleFail(label: string, message: string): never {
  throw new Error(`الدور ${label}: ${message}`);
}

/** Checks one localized { en, ar } pair; returns nothing, throws in Arabic. */
function checkLocalized(def: Record<string, unknown>, field: string, label: string): void {
  const v = def[field];
  if (!isRecord(v) || !isNonEmptyString(v.en) || !isNonEmptyString(v.ar)) {
    roleFail(label, `الحقل ${field} مفقود أو ليس زوجاً لغوياً { en, ar } بنصين غير فارغين`);
  }
}

/** Validates the `employee` contract block (contract.schema.json §2.2.1). */
function checkEmployee(def: Record<string, unknown>, label: string): void {
  const t = def.employee;
  if (!isRecord(t)) roleFail(label, 'الدور من نوع employee يحتاج عقد employee كاملاً (انظر src/registry/roles/influencer.ts)');
  checkLocalized(t, 'name', label);
  if (!isNonEmptyString(t.mission)) roleFail(label, 'الحقل employee.mission مفقود أو فارغ');
  if (!isNonEmptyStringArray(t.scope)) roleFail(label, 'الحقل employee.scope مفقود أو ليس قائمة نصوص غير فارغة');
  if (!isNonEmptyStringArray(t.exclusions)) roleFail(label, 'الحقل employee.exclusions مفقود أو ليس قائمة نصوص غير فارغة');
  if (typeof t.autonomy_level !== 'number' || !Number.isFinite(t.autonomy_level)) {
    roleFail(label, 'الحقل employee.autonomy_level مفقود أو ليس عدداً');
  }
  if (!Array.isArray(t.tools) || t.tools.some((tool: unknown) =>
    !isRecord(tool) || !isNonEmptyString(tool.tool_id) || !isNonEmptyString(tool.description) || typeof tool.is_idempotent !== 'boolean')) {
    roleFail(label, 'الحقل employee.tools مفقود أو فيه أداة بلا tool_id أو description أو is_idempotent');
  }
  if (!isStringArray(t.policies)) roleFail(label, 'الحقل employee.policies مفقود أو ليس قائمة نصوص');
  const rt = t.runtime;
  if (!isRecord(rt) || typeof rt.max_concurrent_tasks !== 'number' || rt.max_concurrent_tasks <= 0
    || typeof rt.task_timeout_seconds !== 'number' || rt.task_timeout_seconds <= 0) {
    roleFail(label, 'الحقل employee.runtime مفقود أو بلا max_concurrent_tasks و task_timeout_seconds موجبين');
  }
  if (!isNonEmptyString(t.identity_prompt)) roleFail(label, 'الحقل employee.identity_prompt مفقود أو فارغ');
  if (!Array.isArray(t.skills) || t.skills.some((s: unknown) => !isRecord(s))) {
    roleFail(label, 'الحقل employee.skills مفقود أو ليس قائمة سجلات');
  }
  if (!isNonEmptyStringArray(t.scorecard)) roleFail(label, 'الحقل employee.scorecard مفقود أو ليس قائمة نصوص غير فارغة');
  if (t.secrets !== undefined && (!Array.isArray(t.secrets) || t.secrets.some((s: unknown) =>
    !isRecord(s) || !isNonEmptyString(s.name) || !isNonEmptyString(s.ref)))) {
    roleFail(label, 'الحقل employee.secrets — إن وُجد — يجب أن يكون قائمة { name, ref }');
  }
}

/**
 * Validates raw definitions (a single RoleDefinition object or an array
 * of them, as default-exported by a role file) against the fields the
 * registry and the employee factory assume. `existing` is the currently
 * registered roles: an id that already exists is accepted only when the
 * new definition is identical to the registered one (idempotent
 * re-registration); any conflicting redefinition is refused.
 */
export function validateRoleDefinitions(defs: unknown, existing: RoleDefinition[] = []): RoleDefinition[] {
  const list = Array.isArray(defs) ? defs : [defs];
  if (list.length === 0) throw new Error('ملف الدور يصدّر قائمة فارغة — لا أدوار لتسجيلها');
  const seen = new Set<string>();
  const existingById = new Map(existing.map((d) => [d.id, d]));
  for (let i = 0; i < list.length; i++) {
    const def = list[i];
    const label = isRecord(def) && typeof def.id === 'string' ? `"${def.id}"` : `رقم ${i + 1}`;
    if (!isRecord(def)) roleFail(label, 'ليس سجلاً (RoleDefinition)');
    if (!isNonEmptyString(def.id) || !ID_RE.test(def.id as string)) {
      roleFail(label, 'الحقل id مفقود أو ليس بصيغة الاستوديو (حرف صغير أولاً ثم أحرف صغيرة وأرقام و"_")');
    }
    const id = def.id as string;
    if (seen.has(id)) roleFail(`"${id}"`, 'مكرر داخل الملف نفسه — كل id يُسجَّل مرة واحدة');
    seen.add(id);
    if (!(NODE_KINDS as readonly string[]).includes(def.kind as string)) {
      roleFail(`"${id}"`, `الحقل kind مفقود أو غير معروف — المقبول: ${NODE_KINDS.join('، ')}`);
    }
    if (!isNonEmptyString(def.category)) roleFail(`"${id}"`, 'الحقل category مفقود أو فارغ');
    checkLocalized(def, 'label', `"${id}"`);
    checkLocalized(def, 'description', `"${id}"`);
    if (!(HORIZONS as readonly string[]).includes(def.architecture_horizon as string)) {
      roleFail(`"${id}"`, `الحقل architecture_horizon مفقود أو غير معروف — المقبول: ${HORIZONS.join('، ')}`);
    }
    if (!(IMPLEMENTATION_STATUSES as readonly string[]).includes(def.implementation_status as string)) {
      roleFail(`"${id}"`, `الحقل implementation_status مفقود أو غير معروف — المقبول: ${IMPLEMENTATION_STATUSES.join('، ')}`);
    }
    if (!Array.isArray(def.inspector) || def.inspector.length === 0
      || def.inspector.some((t: unknown) => !(INSPECTOR_TABS as readonly string[]).includes(t as string))) {
      roleFail(`"${id}"`, `الحقل inspector مفقود أو فارغ أو فيه تبويب غير معروف — المقبول: ${INSPECTOR_TABS.join('، ')}`);
    }
    if (def.network !== undefined && !(NETWORK_MODES as readonly string[]).includes(def.network as string)) {
      roleFail(`"${id}"`, `الحقل network غير معروف — المقبول: ${NETWORK_MODES.join('، ')}`);
    }
    if (def.memory_tier !== undefined && !(MEMORY_TIERS as readonly string[]).includes(def.memory_tier as string)) {
      roleFail(`"${id}"`, `الحقل memory_tier غير معروف — المقبول: ${MEMORY_TIERS.join('، ')}`);
    }
    if (def.hard_no_egress !== undefined && typeof def.hard_no_egress !== 'boolean') {
      roleFail(`"${id}"`, 'الحقل hard_no_egress يجب أن يكون true أو false');
    }
    if (def.permissions !== undefined) {
      const p = def.permissions;
      if (!isRecord(p) || !isStringArray(p.grants) || !isStringArray(p.prohibitions)
        || (p.source !== 'reference' && p.source !== 'derived')) {
        roleFail(`"${id}"`, 'الحقل permissions — إن وُجد — يجب أن يكون { grants: string[]، prohibitions: string[]، source: "reference" | "derived" }');
      }
    }
    if (def.ports !== undefined && (!Array.isArray(def.ports) || def.ports.some((port: unknown) =>
      !isRecord(port) || !isNonEmptyString(port.id)
      || !(CABLE_KINDS as readonly string[]).includes(port.cable as string)
      || (port.direction !== 'in' && port.direction !== 'out')))) {
      roleFail(`"${id}"`, 'الحقل ports — إن وُجد — يجب أن يكون قائمة { id، cable من أنواع الكابلات الستة، direction: "in" | "out" }');
    }
    if (def.zone !== undefined) {
      const z = def.zone;
      if (!isRecord(z) || !(ZONE_KINDS as readonly string[]).includes(z.zone as string)
        || !(NETWORK_MODES as readonly string[]).includes(z.isolation as string)
        || (z.department_class !== undefined && !(DEPARTMENT_CLASSES as readonly string[]).includes(z.department_class as string))) {
        roleFail(`"${id}"`, 'الحقل zone — إن وُجد — يجب أن يكون { zone من أنواع المناطق، isolation من أوضاع الشبكة، department_class اختياري }');
      }
    }
    if (def.kind === 'employee') checkEmployee(def, `"${id}"`);
    else if (def.employee !== undefined) checkEmployee(def, `"${id}"`);
    const registered = existingById.get(id);
    if (registered !== undefined && !deepEqual(def, registered)) {
      roleFail(`"${id}"`, 'مسجل أصلاً بتعريف مختلف — التسجيل يرفض التعارض؛ غيّر الـ id أو طابق التعريف المسجل تماماً');
    }
  }
  return list as RoleDefinition[];
}

/**
 * Derives the import variable from a role file basename, following the
 * convention in src/registry/index.ts (`influencer.ts` →
 * `influencerRoles`). A trailing "roles" is not doubled (`my-roles.ts` →
 * `myRoles`, not `myRolesRoles`).
 */
export function roleFileVariable(basename: string): string {
  const camel = basename
    .replace(/[^A-Za-z0-9]+(.)?/g, (_, c: string | undefined) => (c === undefined ? '' : c.toUpperCase()))
    .replace(/^./, (c) => c.toLowerCase());
  const base = /roles$/i.test(camel) ? camel.slice(0, -5) : camel;
  const variable = `${base}Roles`;
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(variable)) {
    throw new Error(`اسم الملف "${basename}" لا يعطي متغير استيراد صالحاً`);
  }
  return variable;
}

/**
 * Pure string transform: adds the import and the registerRoles call for
 * one role file to src/registry/index.ts. Idempotent — an import or a
 * registration that already exists is left alone. Throws (in Arabic) when
 * the file does not have the expected shape, instead of guessing where
 * the lines belong.
 */
export function editRegistryIndex(source: string, basename: string): { text: string; changed: boolean } {
  const variable = roleFileVariable(basename);
  const importLine = `import ${variable} from './roles/${basename}';`;
  const registerLine = `registerRoles(${variable});`;
  const lines = source.split('\n');
  const hasLine = (line: string) => lines.some((l) => l.trim() === line);
  let changed = false;

  if (!hasLine(importLine)) {
    const lastImport = lines.reduce((acc, l, i) =>
      /^\s*import\s+\w+\s+from\s+'\.\/roles\/[^']+';\s*$/.test(l) ? i : acc, -1);
    if (lastImport === -1) {
      throw new Error('بنية src/registry/index.ts غير متوقعة: لم أجد أي استيراد من \'./roles/\' — عدّل الملف يدوياً');
    }
    lines.splice(lastImport + 1, 0, importLine);
    changed = true;
  }
  if (!hasLine(registerLine)) {
    const lastRegister = lines.reduce((acc, l, i) =>
      /^\s*registerRoles\(\w+\);\s*$/.test(l) ? i : acc, -1);
    if (lastRegister === -1) {
      throw new Error('بنية src/registry/index.ts غير متوقعة: لم أجد أي استدعاء registerRoles(...) — عدّل الملف يدوياً');
    }
    lines.splice(lastRegister + 1, 0, registerLine);
    changed = true;
  }
  return { text: lines.join('\n'), changed };
}

/** Resolves the new roles through getRole in a fresh process: the only
 *  proof that the wiring in index.ts actually took. Throws in Arabic on
 *  any failure. */
function verifyRolesResolve(repoRoot: string, ids: string[]): void {
  const tsx = path.join(repoRoot, 'node_modules', '.bin', 'tsx');
  if (!fs.existsSync(tsx)) {
    throw new Error(`لم أجد tsx في ${repoRoot}/node_modules — ثبّت الاعتماديات أولاً (npm install)`);
  }
  const script = [
    `import { getRole } from './src/registry/index.ts';`,
    `const ids = ${JSON.stringify(ids)};`,
    'const missing = ids.filter((id) => getRole(id) === undefined);',
    `if (missing.length > 0) { console.error('أدوار لم تُحل: ' + missing.join('، ')); process.exit(1); }`,
    `console.log('OK ' + ids.join('، '));`,
  ].join('\n');
  const r = spawnSync(tsx, ['--eval', script], { cwd: repoRoot, encoding: 'utf-8' });
  if (r.status !== 0) {
    const detail = [r.stderr, r.stdout].filter(Boolean).join('\n').trim();
    throw new Error(`فشل التحقق من حل الأدوار الجديدة (${ids.join('، ')}) عبر getRole${detail ? ` — ${detail}` : ''}`);
  }
}

export interface RegisterResult {
  ids: string[];
  /** Absolute path of the installed role file. */
  dest: string;
  /** True when the index.ts edit actually added a line. */
  indexChanged: boolean;
  /** True when the role file was copied (false when already installed). */
  copied: boolean;
}

/**
 * Registers a role file: validates its definitions against the currently
 * registered roles, copies it into src/registry/roles/ (unless already
 * installed with identical bytes), edits src/registry/index.ts
 * idempotently, then verifies in a fresh process that getRole resolves
 * every new role. Touches no other file. A failed verification rolls the
 * copy and the index edit back, then throws.
 */
export async function registerRolesFile(input: string, repoRoot: string = process.cwd()): Promise<RegisterResult> {
  const abs = path.resolve(input);
  if (!fs.existsSync(abs)) throw new Error(`ملف الدور "${input}" غير موجود`);
  if (!/\.ts$/i.test(abs)) throw new Error(`ملف الدور يجب أن يكون TypeScript (.ts) — الملف المعطى: ${input}`);
  const basename = path.basename(abs).replace(/\.ts$/i, '');
  if (!BASENAME_RE.test(basename)) {
    throw new Error(`اسم ملف الدور "${basename}" غير صالح — ابدأ بحرف واستخدم أحرفاً وأرقاماً و"-" و"_" فقط`);
  }
  let mod: { default?: unknown };
  try {
    mod = (await import(pathToFileURL(abs).href)) as { default?: unknown };
  } catch (e) {
    throw new Error(`تعذر تحميل ملف الدور "${input}": ${e instanceof Error ? e.message : String(e)}`);
  }
  const defs = validateRoleDefinitions(mod.default, listRoles());
  const ids = defs.map((d) => d.id);

  const indexPath = path.join(repoRoot, 'src', 'registry', 'index.ts');
  if (!fs.existsSync(indexPath)) {
    throw new Error(`لم أجد ${indexPath} — شغّل الأمر من جذر المستودع`);
  }
  const dest = path.join(repoRoot, 'src', 'registry', 'roles', `${basename}.ts`);
  const indexBefore = fs.readFileSync(indexPath, 'utf-8');

  let copied = false;
  if (path.resolve(dest) !== abs) {
    if (fs.existsSync(dest)) {
      if (fs.readFileSync(dest, 'utf-8') !== fs.readFileSync(abs, 'utf-8')) {
        throw new Error(`ملف "${basename}.ts" موجود أصلاً في src/registry/roles/ بمحتوى مختلف — اختر اسم ملف آخر`);
      }
    } else {
      fs.copyFileSync(abs, dest);
      copied = true;
    }
  }

  let indexChanged = false;
  try {
    const edited = editRegistryIndex(indexBefore, basename);
    if (edited.changed) {
      fs.writeFileSync(indexPath, edited.text, 'utf-8');
      indexChanged = true;
    }
  } catch (e) {
    if (copied) fs.rmSync(dest, { force: true });
    throw e;
  }

  try {
    verifyRolesResolve(repoRoot, ids);
  } catch (e) {
    if (copied) fs.rmSync(dest, { force: true });
    if (indexChanged) fs.writeFileSync(indexPath, indexBefore, 'utf-8');
    throw e;
  }
  return { ids, dest, indexChanged, copied };
}
