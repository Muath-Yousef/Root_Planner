import type { AuditLogger } from './auditLogger';
import type { KillLevel, KillSwitchManager } from './killSwitchManager';
import { microToUsd, usdToMicro } from './pricingCalculator';

/**
 * socroot-admin (MASTER_REFERENCE §3.5): a fixed command tree (OPS-001), not free text. Parsing produces a small AST; nothing here can run a shell.
 * The advisory assistant (OPS-002) only returns command text and the impact plan; `execute` refuses to run for it, and any command that changes
 * state needs the operator to type CONFIRM. Effects on the design are returned as data, so this module stays free of React and of the store.
 */
export const CONFIRM_WORD = 'CONFIRM';
export const CLI_LEVELS: readonly KillLevel[] = ['TASK', 'EMPLOYEE', 'DEPARTMENT', 'GLOBAL'];

export interface ArgDef { name: string; hint: string; values?: readonly string[] }
export interface CommandDef { id: string; path: [string, string]; args: ArgDef[]; mutating: boolean; summary: string }

/** The tree of §3.5.1, verbatim: the same groups, verbs and flags. */
export const COMMAND_TREE: readonly CommandDef[] = [
  { id: 'employee.generate', path: ['employee', 'generate'], mutating: true, summary: 'Create an employee from an approved factory template',
    args: [{ name: 'dept', hint: 'name' }, { name: 'role', hint: 'role' }, { name: 'template', hint: 'id' }] },
  { id: 'employee.validate', path: ['employee', 'validate'], mutating: false, summary: 'Check an employee against the schemas and guards', args: [{ name: 'path', hint: 'employee_dir' }] },
  { id: 'employee.deploy', path: ['employee', 'deploy'], mutating: true, summary: 'Move a valid employee to RUNNING', args: [{ name: 'id', hint: 'employee_id' }] },
  { id: 'employee.status', path: ['employee', 'status'], mutating: false, summary: 'Show the three states of an employee', args: [{ name: 'id', hint: 'employee_id' }] },
  { id: 'kill-switch.activate', path: ['kill-switch', 'activate'], mutating: true, summary: 'Halt a task, employee, department or everything',
    args: [{ name: 'level', hint: 'TASK|EMPLOYEE|DEPARTMENT|GLOBAL', values: CLI_LEVELS }, { name: 'target', hint: 'id' }] },
  { id: 'kill-switch.deactivate', path: ['kill-switch', 'deactivate'], mutating: true, summary: 'Release a kill switch',
    args: [{ name: 'level', hint: 'level', values: CLI_LEVELS }, { name: 'target', hint: 'id' }] },
  { id: 'budget.inspect', path: ['budget', 'inspect'], mutating: false, summary: 'Show the daily cap and spend of a department', args: [{ name: 'dept', hint: 'name' }] },
  { id: 'budget.set-limit', path: ['budget', 'set-limit'], mutating: true, summary: 'Change the daily cap of a department', args: [{ name: 'dept', hint: 'name' }, { name: 'amount', hint: 'usd' }] },
  { id: 'audit.verify-chain', path: ['audit', 'verify-chain'], mutating: false, summary: 'Verify the SHA-256 audit chain', args: [{ name: 'dept', hint: 'name' }, { name: 'from', hint: 'timestamp' }] },
];

export const usageOf = (d: CommandDef): string => `socroot-admin ${d.path.join(' ')} ${d.args.map((a) => `--${a.name} <${a.hint}>`).join(' ')}`;

export interface ParsedCommand { def: CommandDef; args: Record<string, string>; text: string }
export type ParseResult = { ok: true; command: ParsedCommand } | { ok: false; code: string; reason: string; usage?: string };

const SHELL_CHARS = /[;|&`$<>\\\n\r(){}]/;
function tokenize(line: string): string[] | null {
  const out: string[] = []; let cur = '', quote: '"' | "'" | null = null, any = false;
  for (const ch of line.trim()) {
    if (quote) { if (ch === quote) quote = null; else cur += ch; continue; }
    if (ch === '"' || ch === "'") { quote = ch; any = true; continue; }
    if (/\s/.test(ch)) { if (cur || any) out.push(cur); cur = ''; any = false; continue; }
    cur += ch;
  }
  if (quote) return null;
  if (cur || any) out.push(cur);
  return out;
}
const AMOUNT_RE = /^\d{1,9}(?:\.\d{1,6})?$/;

/** Command AST: group, verb and flags only. Shell syntax (pipes, redirects, substitution, chaining) is rejected, never interpreted (OPS-002). */
export function parseCommand(line: string): ParseResult {
  if (SHELL_CHARS.test(line)) return { ok: false, code: 'CLI_SHELL_REJECTED', reason: 'Shell syntax is not accepted. socroot-admin takes one command from the fixed tree and nothing else.' };
  const tokens = tokenize(line);
  if (!tokens) return { ok: false, code: 'CLI_SYNTAX', reason: 'A quote was opened and never closed.' };
  if (tokens[0] === 'socroot-admin') tokens.shift();
  if (tokens.length === 0) return { ok: false, code: 'CLI_EMPTY', reason: 'Type a command, for example: socroot-admin budget inspect --dept dept_opportunity_acquisition' };
  const def = COMMAND_TREE.find((d) => d.path[0] === tokens[0] && d.path[1] === tokens[1]);
  if (!def) {
    const group = COMMAND_TREE.filter((d) => d.path[0] === tokens[0]);
    return group.length
      ? { ok: false, code: 'CLI_UNKNOWN_COMMAND', reason: `${tokens[0]} has no command ${tokens[1] ?? '(none)'}.`, usage: group.map(usageOf).join('\n') }
      : { ok: false, code: 'CLI_UNKNOWN_COMMAND', reason: `${tokens[0]} is not a command group. Groups: ${[...new Set(COMMAND_TREE.map((d) => d.path[0]))].join(', ')}.` };
  }
  const args: Record<string, string> = {}; const rest = tokens.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const t = rest[i];
    if (!t.startsWith('--')) return { ok: false, code: 'CLI_UNEXPECTED_ARG', reason: `Unexpected “${t}”. Values follow a flag, as in --id value.`, usage: usageOf(def) };
    const eq = t.indexOf('=');
    const name = (eq > 0 ? t.slice(2, eq) : t.slice(2));
    const value = eq > 0 ? t.slice(eq + 1) : rest[++i];
    if (!def.args.some((a) => a.name === name)) return { ok: false, code: 'CLI_UNKNOWN_FLAG', reason: `--${name} is not a flag of ${def.path.join(' ')}.`, usage: usageOf(def) };
    if (name in args) return { ok: false, code: 'CLI_DUPLICATE_FLAG', reason: `--${name} was given twice.`, usage: usageOf(def) };
    if (value === undefined || value.startsWith('--') || value === '') return { ok: false, code: 'CLI_MISSING_VALUE', reason: `--${name} needs a value.`, usage: usageOf(def) };
    args[name] = value;
  }
  const missing = def.args.filter((a) => !(a.name in args));
  if (missing.length) return { ok: false, code: 'CLI_MISSING_ARG', reason: `Missing ${missing.map((m) => `--${m.name}`).join(', ')}.`, usage: usageOf(def) };
  for (const a of def.args) {
    const v = args[a.name];
    if (a.values && !a.values.includes(v)) return { ok: false, code: 'CLI_BAD_VALUE', reason: `--${a.name} must be one of ${a.values.join(', ')}.`, usage: usageOf(def) };
    if (a.name === 'amount' && !AMOUNT_RE.test(v)) return { ok: false, code: 'CLI_BAD_VALUE', reason: '--amount is a positive number of US dollars with up to 6 decimals, for example 25.50.', usage: usageOf(def) };
    if (a.name === 'from' && Number.isNaN(Date.parse(v))) return { ok: false, code: 'CLI_BAD_VALUE', reason: '--from must be a timestamp such as 2026-01-15T10:00:00Z.', usage: usageOf(def) };
  }
  return { ok: true, command: { def, args, text: `socroot-admin ${def.path.join(' ')} ${def.args.map((a) => `--${a.name} ${args[a.name]}`).join(' ')}` } };
}

// ---- context and effects ---------------------------------------------------------------------------------------------------------------------

export interface AdminEmployee { employee_id: string; department: string; role: string; lifecycle: string; deployment: string; autonomy: string; error_count: number }
export interface AdminContext {
  employees: AdminEmployee[]; roles: string[]; templates: string[]; departments: string[];
  kill: KillSwitchManager; audit: AuditLogger; budgets: Record<string, { daily_cap_micro: number; spent_micro: number }>;
}
/** What a confirmed command asks the design to do. The store applies these; this module never touches it. */
export type CliEffect =
  | { type: 'add_employee'; template: string; department: string }
  | { type: 'set_deployment'; employee_id: string }
  | { type: 'set_budget_cap'; department: string; daily_cap_micro: number }
  | { type: 'refresh' };
export type CliOutput = { ok: true; lines: string[]; effects: CliEffect[] } | { ok: false; code: string; lines: string[] };
export type Actor = { kind: 'operator' } | { kind: 'assistant' };

const fail = (code: string, message: string): CliOutput => ({ ok: false, code, lines: [message] });
const done = (lines: string[], effects: CliEffect[] = []): CliOutput => ({ ok: true, lines, effects });
const idOf = (p: string) => p.replace(/\/+$/, '').split('/').pop() ?? p;
const findEmployee = (ctx: AdminContext, id: string) => ctx.employees.find((e) => e.employee_id === id);

/** The impact plan shown before CONFIRM. Empty for read-only commands. */
export function impactOf(p: ParsedCommand, ctx: AdminContext): string[] {
  const a = p.args;
  switch (p.def.id) {
    case 'employee.generate': return [`Adds one ${a.template} employee to ${a.dept}, wired to that department's manager.`, 'The contract and manifest are checked against the schemas first.'];
    case 'employee.deploy': { const e = findEmployee(ctx, a.id); return [`Moves ${a.id} from ${e?.deployment ?? 'unknown'} to RUNNING (through PROVISIONING).`]; }
    case 'kill-switch.activate': return [`Halts ${a.level === 'GLOBAL' ? 'the whole company' : `${a.level.toLowerCase()} ${a.target}`} immediately. Releasing DEPARTMENT or GLOBAL later is a human decision.`];
    case 'kill-switch.deactivate': return [`Releases the ${a.level} kill switch on ${a.level === 'GLOBAL' ? 'the whole company' : a.target}.`];
    case 'budget.set-limit': { const cur = ctx.budgets[a.dept]; return [`Changes the daily cap of ${a.dept} from $${cur ? microToUsd(cur.daily_cap_micro) : 'default'} to $${AMOUNT_RE.test(a.amount) ? microToUsd(usdToMicro(a.amount)) : a.amount}.`]; }
    default: return [];
  }
}

/** Runs one parsed command. The assistant can never run anything (OPS-002); a state-changing command needs the typed CONFIRM word. */
export async function execute(p: ParsedCommand, ctx: AdminContext, actor: Actor, confirm: string): Promise<CliOutput> {
  if (actor.kind !== 'operator') return fail('CLI_ASSISTANT_CANNOT_EXECUTE', 'The assistant only suggests commands. A person must run them.');
  if (p.def.mutating && confirm !== CONFIRM_WORD) return fail('CLI_CONFIRMATION_REQUIRED', `This command changes state. Type ${CONFIRM_WORD} to run it.`);
  const a = p.args;
  switch (p.def.id) {
    case 'employee.generate': {
      if (!ctx.departments.includes(a.dept)) return fail('CLI_BAD_VALUE', `Department "${a.dept}" is not on the canvas. Departments: ${ctx.departments.join(', ') || '(none)'}.`);
      if (!ctx.roles.includes(a.role)) return fail('CLI_BAD_VALUE', `Role "${a.role}" is not an employee role. Roles: ${ctx.roles.join(', ')}.`);
      if (!ctx.templates.includes(a.template)) return fail('CLI_BAD_VALUE', `Template "${a.template}" is not an approved factory template. Templates: ${ctx.templates.join(', ')}.`);
      // The studio has one approved template per role (docs/REFERENCE_GAPS.md G-14), so the two flags must name the same thing.
      if (a.template !== a.role) return fail('CLI_BAD_VALUE', `Template ${a.template} builds the ${a.template} role, not ${a.role}. Use --role ${a.template} --template ${a.template}.`);
      return done([`Generating ${a.template} for ${a.dept}…`, 'Six files built; contract and manifest conform to the schemas.'], [{ type: 'add_employee', template: a.template, department: a.dept }]);
    }
    case 'employee.validate': {
      const e = findEmployee(ctx, idOf(a.path));
      if (!e) return fail('CLI_NOT_FOUND', `No employee "${idOf(a.path)}" on the canvas.`);
      return e.error_count === 0 ? done([`${e.employee_id}: valid. No schema, secret, guard or cable errors.`])
        : fail('CLI_VALIDATION_FAILED', `${e.employee_id}: ${e.error_count} error(s). Open the Problems panel to see and fix them.`);
    }
    case 'employee.deploy': {
      const e = findEmployee(ctx, a.id);
      if (!e) return fail('CLI_NOT_FOUND', `No employee "${a.id}" on the canvas.`);
      if (e.error_count > 0) return fail('CLI_VALIDATION_FAILED', `${e.employee_id} has ${e.error_count} error(s). Fix them before deploying.`);
      if (e.lifecycle === 'DEPRECATED') return fail('CLI_REFUSED', `${e.employee_id} is DEPRECATED and cannot be deployed.`);
      if (e.deployment === 'RUNNING' || e.deployment === 'HEALTHY') return done([`${e.employee_id} is already ${e.deployment}.`]);
      if (ctx.kill.halted({ employee_id: e.employee_id, department_id: e.department })) return fail('CLI_REFUSED', `${e.employee_id} is halted by a kill switch. Release it first.`);
      return done([`Deploying ${e.employee_id}…`, 'STOPPED → PROVISIONING → RUNNING.'], [{ type: 'set_deployment', employee_id: e.employee_id }]);
    }
    case 'employee.status': {
      const e = findEmployee(ctx, a.id);
      if (!e) return fail('CLI_NOT_FOUND', `No employee "${a.id}" on the canvas.`);
      const halted = ctx.kill.halted({ employee_id: e.employee_id, department_id: e.department });
      return done([`${e.employee_id} (${e.role}, ${e.department})`, `lifecycle   ${e.lifecycle}`, `deployment  ${e.deployment}`, `autonomy    ${e.autonomy}`, `errors      ${e.error_count}`, `kill switch ${halted ? `${halted.level} (${halted.reason})` : 'none'}`]);
    }
    case 'kill-switch.activate': {
      const level = a.level as KillLevel, target = level === 'GLOBAL' ? '*' : a.target;
      if (level === 'GLOBAL' && a.target !== '*' && a.target.toLowerCase() !== 'all') return fail('CLI_BAD_VALUE', 'For GLOBAL use --target "*" (or all).');
      if (level === 'EMPLOYEE' && !findEmployee(ctx, a.target)) return fail('CLI_NOT_FOUND', `No employee "${a.target}" on the canvas.`);
      if (level === 'DEPARTMENT' && !ctx.departments.includes(a.target)) return fail('CLI_NOT_FOUND', `No department "${a.target}" on the canvas.`);
      const r = ctx.kill.engage(level, target, 'socroot-admin', 'Engaged from the socroot-admin console');
      return r.ok ? done([`Kill switch ${level} ${target} is active.`], [{ type: 'refresh' }]) : fail(r.code, r.reason);
    }
    case 'kill-switch.deactivate': {
      const level = a.level as KillLevel, target = level === 'GLOBAL' ? '*' : a.target;
      const r = ctx.kill.release(level, target, 'Released from the socroot-admin console', true);
      return r.ok ? done([`Kill switch ${level} ${target} released.`], [{ type: 'refresh' }]) : fail(r.code, r.reason);
    }
    case 'budget.inspect': {
      if (!ctx.departments.includes(a.dept)) return fail('CLI_NOT_FOUND', `No department "${a.dept}" on the canvas.`);
      const b = ctx.budgets[a.dept] ?? { daily_cap_micro: 0, spent_micro: 0 };
      return done([`${a.dept}`, `daily cap  $${microToUsd(b.daily_cap_micro)}`, `spent today $${microToUsd(b.spent_micro)}`, `available   $${microToUsd(b.daily_cap_micro - b.spent_micro)}`]);
    }
    case 'budget.set-limit': {
      if (!ctx.departments.includes(a.dept)) return fail('CLI_NOT_FOUND', `No department "${a.dept}" on the canvas.`);
      const micro = usdToMicro(a.amount);
      if (micro <= 0) return fail('CLI_BAD_VALUE', '--amount must be above zero.');
      return done([`Daily cap of ${a.dept} is now $${microToUsd(micro)}.`], [{ type: 'set_budget_cap', department: a.dept, daily_cap_micro: micro }]);
    }
    case 'audit.verify-chain': {
      if (!ctx.departments.includes(a.dept)) return fail('CLI_NOT_FOUND', `No department "${a.dept}" on the canvas.`);
      const from = Date.parse(a.from), since = ctx.audit.records.filter((r) => Date.parse(r.created_at) >= from).length;
      const r = await ctx.audit.verify();
      return r.ok ? done([`Chain intact: ${r.length} records, ${since} since ${a.from}.`]) : { ok: false, code: r.code, lines: [r.message] };
    }
    default: return fail('CLI_UNKNOWN_COMMAND', `No handler for ${p.def.id}.`);
  }
}

// ---- advisory assistant ----------------------------------------------------------------------------------------------------------------------

export interface Suggestion { command: string; why: string; impact: string[] }
export interface Advice { note: string; suggestions: Suggestion[] }

/**
 * Deterministic and offline (no model call, no shell): it matches words in the question and proposes commands built from the real
 * employees and departments on the canvas, with the impact plan beside each. It never runs anything.
 */
export function advise(question: string, ctx: AdminContext): Advice {
  const q = question.toLowerCase(), out: Suggestion[] = [];
  const dept = ctx.departments[0], worst = [...ctx.employees].sort((x, y) => y.error_count - x.error_count)[0], first = ctx.employees[0];
  const add = (command: string, why: string) => { const r = parseCommand(command); if (r.ok && !out.some((s) => s.command === r.command.text)) out.push({ command: r.command.text, why, impact: impactOf(r.command, ctx) }); };
  if (/(error|problem|invalid|broken|fail|wrong)/.test(q) && worst) add(`socroot-admin employee validate --path ${worst.employee_id}`, `${worst.employee_id} has the most errors (${worst.error_count}).`);
  if (/(status|state|running|health|alive)/.test(q) && first) add(`socroot-admin employee status --id ${(worst ?? first).employee_id}`, 'Shows lifecycle, deployment and autonomy.');
  if (/(deploy|start|launch|run)/.test(q) && first) add(`socroot-admin employee deploy --id ${first.employee_id}`, 'Moves the employee to RUNNING if it is valid.');
  if (/(kill|stop|halt|freeze|emergency)/.test(q)) {
    if (first) add(`socroot-admin kill-switch activate --level EMPLOYEE --target ${first.employee_id}`, 'Halts one employee only. Narrowest first.');
    if (dept) add(`socroot-admin kill-switch activate --level DEPARTMENT --target ${dept}`, 'Halts a whole department.');
  }
  if (/(release|resume|unfreeze|restart)/.test(q) && ctx.kill.records().length) { const r = ctx.kill.records()[0]; add(`socroot-admin kill-switch deactivate --level ${r.level} --target ${r.target}`, `Releases the ${r.level} switch on ${r.target}.`); }
  if (/(budget|cost|spend|money|cap|limit)/.test(q) && dept) { add(`socroot-admin budget inspect --dept ${dept}`, 'Shows cap and spend.'); add(`socroot-admin budget set-limit --dept ${dept} --amount 10.00`, 'Sets a daily cap. Change the amount to what you need.'); }
  if (/(audit|log|tamper|chain|verify|integrity)/.test(q) && dept) add(`socroot-admin audit verify-chain --dept ${dept} --from 2026-01-01T00:00:00Z`, 'Walks the SHA-256 chain from the start and reports tampering.');
  if (/(add|new|create|generate|hire)/.test(q) && dept && ctx.templates[0]) add(`socroot-admin employee generate --dept ${dept} --role ${ctx.templates[0]} --template ${ctx.templates[0]}`, 'Builds a new employee from an approved template. Change the role to the one you need.');
  if (out.length === 0) return { note: 'I could not match that to a command. Try words like status, errors, deploy, stop, budget, audit or add employee.', suggestions: [] };
  return { note: 'These are suggestions only. Review the impact, then press “Use this command”, type CONFIRM and run it yourself.', suggestions: out.slice(0, 4) };
}
