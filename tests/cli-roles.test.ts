import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { getRole, listRoles } from '../src/registry';
import type { RoleDefinition } from '../src/registry';
import { editRegistryIndex, roleFileVariable, validateRoleDefinitions } from '../src/cli/roles';

/**
 * Phase 4b — `roles register <file>`.
 *
 * Unit tests judge the validation and the index.ts edit as pure
 * functions (no filesystem writes). The spawned end-to-end tests run the
 * real command in a TEMP copy of the repo — never the real tree — and
 * assert the role resolves there while the real src/registry/ keeps
 * exactly its current roles.
 */

const ROOT = process.cwd();
const INDEX_PATH = path.join(ROOT, 'src', 'registry', 'index.ts');
const ROLES_DIR = path.join(ROOT, 'src', 'registry', 'roles');

const guardRole = (id: string, labelEn = 'Fixture Greeter'): RoleDefinition => ({
  id, kind: 'guard', category: 'Guards',
  label: { en: labelEn, ar: 'مُرحِّب تجريبي' },
  description: { en: 'A throwaway fixture role.', ar: 'دور تجريبي.' },
  architecture_horizon: 'TRANSITIONAL', implementation_status: 'PLANNED',
  inspector: ['identity'], network: 'internal',
});

const employeeRole = (id: string): RoleDefinition => ({
  id, kind: 'employee', category: 'Employees',
  label: { en: 'Fixture Employee', ar: 'موظف تجريبي' },
  description: { en: 'A throwaway fixture employee role.', ar: 'دور موظف تجريبي.' },
  architecture_horizon: 'TRANSITIONAL', implementation_status: 'PLANNED',
  inspector: ['identity', 'contract'], schema_ref: 'contract', network: 'internal',
  permissions: { grants: ['model:invoke', 'task:read', 'task:complete'], prohibitions: ['web:*'], source: 'derived' },
  employee: {
    name: { en: 'Fixture Employee', ar: 'موظف تجريبي' },
    mission: 'Do fixture work for the test only.',
    scope: ['Receive tasks from the manager only'],
    exclusions: ['Does not contact the web'],
    autonomy_level: 1,
    tools: [{ tool_id: 'do_fixture_work', description: 'Do fixture work', is_idempotent: true }],
    policies: ['POL_DEFAULT_DENY'],
    runtime: { max_concurrent_tasks: 5, task_timeout_seconds: 60 },
    identity_prompt: 'You are a fixture employee role used only by tests.',
    skills: [{ name: 'fixture_playbook.md', body: '# Fixture\n' }],
    scorecard: ['fixture_done'],
  },
});

describe('Phase 4b — validateRoleDefinitions', () => {
  it('accepts a single definition object and an array of definitions', () => {
    expect(validateRoleDefinitions(guardRole('fix_a'))).toHaveLength(1);
    expect(validateRoleDefinitions([guardRole('fix_a'), employeeRole('fix_b')])).toHaveLength(2);
  });

  it('rejects missing or malformed required fields, naming the field in Arabic', () => {
    const cases: [string, unknown, RegExp][] = [
      ['no id', { ...guardRole('fix_a'), id: undefined }, /id/],
      ['bad id shape', guardRole('Fix A'), /id/],
      ['unknown kind', { ...guardRole('fix_a'), kind: 'wizard' }, /kind/],
      ['missing category', { ...guardRole('fix_a'), category: '' }, /category/],
      ['label without ar', { ...guardRole('fix_a'), label: { en: 'X', ar: '' } }, /label/],
      ['description without en', { ...guardRole('fix_a'), description: { en: '', ar: 'س' } }, /description/],
      ['unknown horizon', { ...guardRole('fix_a'), architecture_horizon: 'SOON' }, /architecture_horizon/],
      ['unknown status', { ...guardRole('fix_a'), implementation_status: 'DONE' }, /implementation_status/],
      ['empty inspector', { ...guardRole('fix_a'), inspector: [] }, /inspector/],
      ['unknown inspector tab', { ...guardRole('fix_a'), inspector: ['magic'] }, /inspector/],
      ['bad permissions source', { ...guardRole('fix_a'), permissions: { grants: [], prohibitions: [], source: 'maybe' } }, /permissions/],
      ['bad port direction', { ...guardRole('fix_a'), ports: [{ id: 'p', cable: 'MEMORY_BUS', direction: 'sideways' }] }, /ports/],
      ['bad port cable', { ...guardRole('fix_a'), ports: [{ id: 'p', cable: 'SMOKE_SIGNAL', direction: 'in' }] }, /ports/],
      ['employee without contract', { ...employeeRole('fix_b'), employee: undefined }, /employee/],
      ['employee without mission', { ...employeeRole('fix_b'), employee: { ...employeeRole('fix_b').employee!, mission: '' } }, /mission/],
      ['not an object', 'just a string', /ليس سجلاً|فارغة/],
      ['null', null, /ليس سجلاً|فارغة/],
      ['empty array', [], /فارغة/],
    ];
    for (const [name, defs, pattern] of cases) {
      expect(() => validateRoleDefinitions(defs), name).toThrowError(pattern);
    }
  });

  it('rejects duplicate ids inside one file', () => {
    expect(() => validateRoleDefinitions([guardRole('fix_dup'), guardRole('fix_dup')]))
      .toThrowError(/fix_dup.*مكرر|مكرر.*fix_dup/);
  });

  it('refuses a conflicting redefinition of an already-registered id, in Arabic', () => {
    const clash = { ...getRole('collector')!, label: { en: 'Other', ar: 'آخر' } };
    expect(() => validateRoleDefinitions(clash, listRoles())).toThrowError(/collector.*مسجل أصلاً|مسجل أصلاً.*collector/);
  });

  it('accepts an identical redefinition (idempotent re-registration), key order aside', () => {
    const registered = getRole('collector')!;
    expect(validateRoleDefinitions(registered, listRoles())).toHaveLength(1);
    const reordered = { label: registered.label, id: registered.id, kind: registered.kind, category: registered.category,
      description: registered.description, architecture_horizon: registered.architecture_horizon,
      implementation_status: registered.implementation_status, inspector: registered.inspector,
      schema_ref: registered.schema_ref, network: registered.network, permissions: registered.permissions,
      employee: registered.employee, ref: registered.ref } as RoleDefinition;
    expect(validateRoleDefinitions(reordered, listRoles())).toHaveLength(1);
  });
});

describe('Phase 4b — editRegistryIndex (pure string transform)', () => {
  const indexText = fs.readFileSync(INDEX_PATH, 'utf-8');

  it('derives the import variable from the basename, without doubling "roles"', () => {
    expect(roleFileVariable('influencer')).toBe('influencerRoles');
    expect(roleFileVariable('my-roles')).toBe('myRoles');
    expect(roleFileVariable('my_roles')).toBe('myRoles');
    expect(roleFileVariable('greeter')).toBe('greeterRoles');
  });

  it('adds the import and the registerRoles call; removing them restores the original', () => {
    const { text, changed } = editRegistryIndex(indexText, 'fixture_greeter');
    expect(changed).toBe(true);
    expect(text).toContain(`import fixtureGreeterRoles from './roles/fixture_greeter';`);
    expect(text).toContain('registerRoles(fixtureGreeterRoles);');
    const stripped = text
      .replace(`import fixtureGreeterRoles from './roles/fixture_greeter';\n`, '')
      .replace('registerRoles(fixtureGreeterRoles);\n', '');
    expect(stripped).toBe(indexText);
  });

  it('is idempotent: a second application changes nothing', () => {
    const once = editRegistryIndex(indexText, 'fixture_greeter');
    const twice = editRegistryIndex(once.text, 'fixture_greeter');
    expect(twice.changed).toBe(false);
    expect(twice.text).toBe(once.text);
  });

  it('refuses a file without the expected shape instead of guessing', () => {
    expect(() => editRegistryIndex('export const x = 1;\n', 'fixture_greeter')).toThrowError(/غير متوقعة/);
    const noRegister = `import aRoles from './roles/a';\n`;
    expect(() => editRegistryIndex(noRegister, 'fixture_greeter')).toThrowError(/غير متوقعة/);
  });
});

describe('Phase 4b — roles register end-to-end (spawned, temp repo copy)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'socroot-roles-'));
  const tmpRepo = path.join(tmp, 'repo');
  const tsx = path.join(ROOT, 'node_modules', '.bin', 'tsx');
  const run = (args: string[]) => spawnSync(tsx, ['src/cli/index.ts', ...args], { cwd: tmpRepo, encoding: 'utf-8' });
  const evalIn = (script: string) => spawnSync(tsx, ['--eval', script], { cwd: tmpRepo, encoding: 'utf-8' });
  const sha256 = (p: string): string => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

  const FIXTURE_NAME = 'fixture_greeter_role';
  const fixtureSrc = path.join(tmpRepo, `${FIXTURE_NAME}.ts`);
  const fixtureDest = path.join(tmpRepo, 'src', 'registry', 'roles', `${FIXTURE_NAME}.ts`);
  const tmpIndex = path.join(tmpRepo, 'src', 'registry', 'index.ts');

  const fixtureText = `export default [
  {
    id: 'fixture_greeter',
    kind: 'guard',
    category: 'Guards',
    label: { en: 'Fixture Greeter', ar: 'مُرحِّب تجريبي' },
    description: { en: 'A throwaway fixture role used only by the roles-register e2e test.', ar: 'دور تجريبي يُستخدم في اختبار أمر التسجيل فقط.' },
    architecture_horizon: 'TRANSITIONAL',
    implementation_status: 'PLANNED',
    inspector: ['identity'],
    network: 'internal',
  },
];
`;

  // One temp copy of the working tree (new code included), node_modules
  // symlinked so the spawned CLI resolves tsx and the registry imports.
  fs.cpSync(ROOT, tmpRepo, {
    recursive: true,
    filter: (src) => !['.git', 'node_modules', 'dist', 'coverage', 'build', 'test-results', 'playwright-report']
      .includes(path.basename(src)),
  });
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(tmpRepo, 'node_modules'), 'dir');
  fs.writeFileSync(fixtureSrc, fixtureText, 'utf-8');
  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('registers the fixture role: files land in place and getRole resolves it', { timeout: 30000 }, () => {
    const r = run(['roles', 'register', fixtureSrc]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/fixture_greeter/);
    expect(fs.readFileSync(fixtureDest, 'utf-8')).toBe(fixtureText);
    const indexText = fs.readFileSync(tmpIndex, 'utf-8');
    expect(indexText).toContain(`import fixtureGreeterRoleRoles from './roles/${FIXTURE_NAME}';`);
    expect(indexText).toContain('registerRoles(fixtureGreeterRoleRoles);');
    const check = evalIn(`import { getRole } from './src/registry/index.ts'; console.log(getRole('fixture_greeter')?.id ?? 'missing');`);
    expect(check.status, check.stderr).toBe(0);
    expect(check.stdout.trim()).toBe('fixture_greeter');
  });

  it('re-registering the same file is a no-op (exit 0, files unchanged)', { timeout: 30000 }, () => {
    const indexBefore = sha256(tmpIndex);
    const destBefore = sha256(fixtureDest);
    const r = run(['roles', 'register', fixtureSrc]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/كان مسجلاً أصلاً/);
    expect(sha256(tmpIndex)).toBe(indexBefore);
    expect(sha256(fixtureDest)).toBe(destBefore);
  });

  it('re-registering the already-installed influencer.ts is a no-op', { timeout: 30000 }, () => {
    const indexBefore = sha256(tmpIndex);
    const r = run(['roles', 'register', path.join(tmpRepo, 'src', 'registry', 'roles', 'influencer.ts')]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/collector، content_selector، creator/);
    expect(sha256(tmpIndex)).toBe(indexBefore);
  });

  it('refuses an invalid file with an Arabic error and touches nothing', { timeout: 30000 }, () => {
    const badSrc = path.join(tmpRepo, 'bad-role.ts');
    fs.writeFileSync(badSrc, 'export default [{ kind: "guard" }];\n', 'utf-8');
    const indexBefore = sha256(tmpIndex);
    const rolesBefore = fs.readdirSync(path.join(tmpRepo, 'src', 'registry', 'roles')).sort();
    const r = run(['roles', 'register', badSrc]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/id/);
    expect(sha256(tmpIndex)).toBe(indexBefore);
    expect(fs.readdirSync(path.join(tmpRepo, 'src', 'registry', 'roles')).sort()).toEqual(rolesBefore);
  });

  it('refuses a conflicting redefinition of collector and touches nothing', { timeout: 30000 }, () => {
    const clashSrc = path.join(tmpRepo, 'clash-role.ts');
    fs.writeFileSync(clashSrc, `export default [{ id: 'collector', kind: 'guard', category: 'Guards', label: { en: 'Other', ar: 'آخر' }, description: { en: 'x', ar: 'س' }, architecture_horizon: 'TRANSITIONAL', implementation_status: 'PLANNED', inspector: ['identity'] }];\n`, 'utf-8');
    const indexBefore = sha256(tmpIndex);
    const r = run(['roles', 'register', clashSrc]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/مسجل أصلاً/);
    expect(sha256(tmpIndex)).toBe(indexBefore);
    expect(fs.existsSync(path.join(tmpRepo, 'src', 'registry', 'roles', 'clash-role.ts'))).toBe(false);
  });

  it('the fixture role never leaks into the real tree', () => {
    expect(getRole('fixture_greeter')).toBeUndefined();
    expect(fs.existsSync(path.join(ROLES_DIR, `${FIXTURE_NAME}.ts`))).toBe(false);
  });
});
