import { useState, lazy, Suspense } from 'react';
import type { SNode } from '../../../types';
import { employeePy, PEP_BEGIN, PEP_END } from '../../../engine/generators';
import { editCustomCode } from '../../../engine/inspectorEdit';
import { useStudio } from '../../../store/useStudioStore';
import { useT } from '../../../i18n/useT';

const CodeEditor = lazy(() => import('../CodeEditor'));

interface CodeTabProps {
  node: SNode;
}

export function CodeTab({ node }: CodeTabProps) {
  const tr = useT();
  const applyEdit = useStudio((s) => s.applyEdit);
  const emp = node.data.employee;

  const [customCode, setCustomCode] = useState(emp?.custom_code ?? '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showFullPy, setShowFullPy] = useState(false);

  if (!emp) {
    return <div className="text-slate-400">{tr('inspector.error', { message: 'No employee code available.' })}</div>;
  }

  const fullPy = employeePy(emp);

  const handleSaveCustom = () => {
    setErrorMsg(null);
    setSaveSuccess(false);
    const res = applyEdit(node.id, (n, tid) => editCustomCode(n, tid, customCode));
    if (!res.ok) {
      setErrorMsg(`[${res.code}] ${res.message}`);
    } else {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    }
  };

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          employee.py (§2.1.3, §2.4)
        </h3>
        <button
          onClick={() => setShowFullPy(!showFullPy)}
          className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-700"
        >
          {showFullPy ? 'Edit Custom Code' : 'View Full employee.py'}
        </button>
      </div>

      {errorMsg && (
        <div role="alert" className="rounded border border-rose-500/50 bg-rose-950/60 p-2 text-xs text-rose-300">
          {errorMsg}
        </div>
      )}

      {saveSuccess && (
        <div className="rounded border border-emerald-500/50 bg-emerald-950/60 p-2 text-xs text-emerald-300">
          {tr('inspector.saved')}
        </div>
      )}

      {/* Locked PEP Notice (SCA-002) */}
      <div className="rounded border border-sky-500/40 bg-sky-950/40 p-2.5 text-xs text-sky-200">
        <div className="font-semibold text-sky-300">Locked Embedded PEP Guardrails (SCA-002)</div>
        <p className="mt-1 text-[11px] text-sky-200/80">
          {tr('inspector.pep.locked')} Interceptors for Kill-Switch, Budget Pre-Reserve, Policy Enforce, and Ephemeral Wipe cannot be dropped.
        </p>
      </div>

      {showFullPy ? (
        <div className="space-y-2">
          <div className="text-[11px] text-slate-400">Read-Only Full employee.py (with embedded PEP & BaseEmployee inheritance):</div>
          <Suspense fallback={<div className="h-64 rounded bg-slate-900 text-slate-500 p-4">Loading editor…</div>}>
            <CodeEditor
              value={fullPy}
              language="python"
              readOnly={true}
              height="360px"
            />
          </Suspense>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="font-medium text-slate-300">{tr('inspector.custom.code')}</span>
            <span className="text-[11px] text-slate-500">Python 3.11</span>
          </div>

          <Suspense fallback={<div className="h-64 rounded bg-slate-900 text-slate-500 p-4">Loading editor…</div>}>
            <CodeEditor
              value={customCode}
              onChange={setCustomCode}
              language="python"
              height="280px"
            />
          </Suspense>

          <div className="flex justify-between items-center">
            <span className="text-[11px] text-slate-400">
              SEC-001: Secrets must use vault://. Any plaintext token is rejected.
            </span>
            <button
              onClick={handleSaveCustom}
              className="rounded bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500"
            >
              {tr('inspector.save')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
