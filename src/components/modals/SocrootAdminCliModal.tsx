import { useState, useMemo } from 'react';
import { useStudio } from '../../store/useStudioStore';
import {
  parseCommand,
  execute,
  advise,
  impactOf,
  CONFIRM_WORD,
  COMMAND_TREE,
  usageOf,
  type AdminContext,
  type AdminEmployee,
  type Advice,
} from '../../engine/adminCli';
import { dockTemplates } from '../../registry';
import { collectProblems } from '../../engine/problems';
import { usdToMicro } from '../../engine/pricingCalculator';
import { useT } from '../../i18n/useT';
import { useModalA11y } from '../layout/useModalA11y';

interface HistoryItem {
  command: string;
  lines: string[];
  ok: boolean;
}

export function SocrootAdminCliModal() {
  const tr = useT();
  const cliModalOpen = useStudio((s) => s.cliModalOpen);
  const setCliModalOpen = useStudio((s) => s.setCliModalOpen);
  const nodes = useStudio((s) => s.nodes);
  const edges = useStudio((s) => s.edges);
  const tenant_id = useStudio((s) => s.tenant_id);
  const horizon = useStudio((s) => s.horizon);
  const killSwitch = useStudio((s) => s.killSwitch);
  const auditLogger = useStudio((s) => s.auditLogger);
  const budgets = useStudio((s) => s.budgets);
  const applyCliEffect = useStudio((s) => s.applyCliEffect);

  const [inputLine, setInputLine] = useState('');
  const [confirmInput, setConfirmInput] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([
    {
      command: 'socroot-admin --help',
      lines: [
        'socroot-admin v1.1 — Deterministic Operations Shell (OPS-001, OPS-002)',
        'Type a command or use the Advisory Assistant below.',
      ],
      ok: true,
    },
  ]);
  const [advisoryQuestion, setAdvisoryQuestion] = useState('');
  const [advice, setAdvice] = useState<Advice | null>(null);

  const dialogRef = useModalA11y<HTMLDivElement>(cliModalOpen, () => setCliModalOpen(false));

  // Build AdminContext from store
  const adminCtx: AdminContext = useMemo(() => {
    const problems = collectProblems(nodes, edges, { tenant_id });
    const empNodes = nodes.filter((n) => n.data.kind === 'employee' && n.data.employee);
    const employees: AdminEmployee[] = empNodes.map((n) => {
      const c = n.data.employee!;
      const ct = c.contract as { employee_id?: string; department?: string; role?: string };
      const id = ct.employee_id ?? n.id;
      const dept = ct.department ?? 'unassigned';
      const nodeErrors = problems.filter((p) => p.nodeId === n.id && p.severity === 'error').length;
      return {
        employee_id: id,
        department: dept,
        role: ct.role ?? n.data.role,
        lifecycle: c.lifecycle,
        deployment: c.deployment,
        autonomy: c.autonomy,
        error_count: nodeErrors,
      };
    });

    const roles = dockTemplates(horizon, '', 'en')
      .filter((t) => t.category === 'Employees')
      .map((t) => t.id);

    const depts = [
      ...new Set(
        nodes
          .map((n) => n.data.zone?.department_id ?? (n.data.employee?.contract as { department?: string } | undefined)?.department)
          .filter((d): d is string => !!d)
      ),
    ];

    const budgetsMicro: Record<string, { daily_cap_micro: number; spent_micro: number }> = {};
    for (const [dept, b] of Object.entries(budgets)) {
      budgetsMicro[dept] = {
        daily_cap_micro: usdToMicro(b.daily_cap_usd),
        spent_micro: usdToMicro(b.spent_usd),
      };
    }

    return {
      employees,
      roles,
      templates: roles,
      departments: depts.length ? depts : ['dept_opportunity_acquisition'],
      kill: killSwitch,
      audit: auditLogger,
      budgets: budgetsMicro,
    };
  }, [nodes, edges, tenant_id, horizon, killSwitch, auditLogger, budgets]);

  const parsed = useMemo(() => {
    if (!inputLine.trim()) return null;
    return parseCommand(inputLine);
  }, [inputLine]);

  const impact = useMemo(() => {
    if (!parsed || !parsed.ok) return [];
    return impactOf(parsed.command, adminCtx);
  }, [parsed, adminCtx]);

  if (!cliModalOpen) return null;

  const handleExecute = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!parsed) return;
    if (!parsed.ok) {
      setHistory((prev) => [
        ...prev,
        {
          command: inputLine,
          lines: [parsed.reason, ...(parsed.usage ? [parsed.usage] : [])],
          ok: false,
        },
      ]);
      return;
    }

    const res = await execute(parsed.command, adminCtx, { kind: 'operator' }, confirmInput);
    setHistory((prev) => [
      ...prev,
      {
        command: parsed.command.text,
        lines: res.lines,
        ok: res.ok,
      },
    ]);

    if (res.ok) {
      for (const eff of res.effects) {
        applyCliEffect(eff);
      }
      setConfirmInput('');
    }
  };

  const handleAskAdvisor = () => {
    if (!advisoryQuestion.trim()) return;
    const res = advise(advisoryQuestion, adminCtx);
    setAdvice(res);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cli-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
    >
      <div
        ref={dialogRef}
        className="flex h-[85vh] w-full max-w-4xl flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-5 py-3">
          <div className="flex items-center gap-2">
            <span id="cli-modal-title" className="font-mono text-sm font-bold text-sky-400">socroot-admin</span>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400 font-mono">
              AST Shell & Advisory Assistant
            </span>
          </div>
          <button
            onClick={() => setCliModalOpen(false)}
            aria-label={tr('inspector.close')}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            ✕
          </button>
        </div>

        {/* Content layout */}
        <div className="flex flex-1 min-h-0 flex-col md:flex-row">
          {/* Main Terminal Screen */}
          <div className="flex flex-1 flex-col border-b md:border-b-0 md:border-e border-slate-800 p-4">
            {/* Terminal History */}
            <div className="flex-1 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs space-y-3">
              {history.map((h, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-1.5 text-sky-400">
                    <span className="text-slate-500">$</span>
                    <span className="font-semibold">{h.command}</span>
                  </div>
                  <div className={h.ok ? 'text-slate-300' : 'text-rose-400'}>
                    {h.lines.map((l, li) => (
                      <div key={li}>{l}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Impact Plan / Confirmation requirement */}
            {parsed && parsed.ok && impact.length > 0 && (
              <div className="mt-3 rounded border border-amber-500/40 bg-amber-950/30 p-2.5 text-xs">
                <div className="font-semibold text-amber-300">Impact Plan:</div>
                <ul className="mt-1 list-disc ps-4 text-amber-200/90 text-[11px]">
                  {impact.map((im, idx) => (
                    <li key={idx}>{im}</li>
                  ))}
                </ul>
                {parsed.command.def.mutating && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-slate-300 text-[11px] font-mono">
                      Type <strong className="text-amber-400 font-bold">{CONFIRM_WORD}</strong>:
                    </span>
                    <input
                      placeholder="CONFIRM"
                      value={confirmInput}
                      onChange={(e) => setConfirmInput(e.target.value)}
                      className="w-28 rounded border border-amber-600/70 bg-slate-900 px-2 py-0.5 font-mono text-xs text-slate-100"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Input Bar */}
            <form onSubmit={handleExecute} className="mt-3 flex gap-2">
              <div className="flex flex-1 items-center rounded border border-slate-700 bg-slate-950 px-3">
                <span className="text-slate-500 font-mono text-xs me-2">$</span>
                <input
                  value={inputLine}
                  onChange={(e) => setInputLine(e.target.value)}
                  placeholder="e.g. socroot-admin employee status --id opp_acq.evaluator.v1"
                  className="w-full bg-transparent py-2 font-mono text-xs text-slate-100 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="rounded bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500"
              >
                {tr('cli.run')}
              </button>
            </form>
          </div>

          {/* Sidebar: Advisory Assistant & Quick Commands */}
          <div className="w-full md:w-80 flex flex-col p-4 bg-slate-950/40 overflow-y-auto space-y-4 text-xs">
            {/* Advisory Assistant (OPS-002) */}
            <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
              <h3 className="font-semibold text-sky-400 uppercase tracking-wider text-[11px]">
                {tr('cli.advisory')}
              </h3>
              <p className="text-[11px] text-slate-400">
                Offline advisory AI. Recommends commands with impact plans; never executes directly.
              </p>
              <div className="flex gap-1.5">
                <input
                  placeholder="e.g. which employee has errors?"
                  value={advisoryQuestion}
                  onChange={(e) => setAdvisoryQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAskAdvisor()}
                  className="flex-1 rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-100"
                />
                <button
                  onClick={handleAskAdvisor}
                  className="rounded bg-slate-800 px-2.5 py-1 text-xs text-sky-400 hover:bg-slate-700"
                >
                  Ask
                </button>
              </div>

              {advice && (
                <div className="mt-2 space-y-2 border-t border-slate-800 pt-2">
                  <div className="text-[11px] text-slate-300 italic">{advice.note}</div>
                  {advice.suggestions.map((s, idx) => (
                    <div key={idx} className="rounded border border-slate-800 bg-slate-950 p-2 space-y-1">
                      <div className="font-mono text-[10px] text-amber-300 break-all">{s.command}</div>
                      <div className="text-[10px] text-slate-400">{s.why}</div>
                      <button
                        onClick={() => {
                          setInputLine(s.command);
                          setConfirmInput('');
                        }}
                        className="text-[10px] text-sky-400 hover:underline"
                      >
                        {tr('cli.use.cmd')} →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Reference of Command Tree */}
            <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
              <h3 className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                Command Tree (§3.5.1)
              </h3>
              <div className="space-y-1.5">
                {COMMAND_TREE.map((cmd) => (
                  <button
                    key={cmd.id}
                    onClick={() => setInputLine(usageOf(cmd))}
                    className="block w-full text-start text-[11px] font-mono text-slate-400 hover:text-sky-400 truncate"
                    title={cmd.summary}
                  >
                    {cmd.path.join(' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
