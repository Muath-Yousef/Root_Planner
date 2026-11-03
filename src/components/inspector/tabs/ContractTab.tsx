import { useState, useEffect, lazy, Suspense } from 'react';
import type { SNode } from '../../../types';
import { editDocument, documentText, locateField, setIdentity, setRuntimeLimits } from '../../../engine/inspectorEdit';
import type { ValidationIssue } from '../../../schemas/validator';
import { useStudio } from '../../../store/useStudioStore';
import { useT } from '../../../i18n/useT';

const CodeEditor = lazy(() => import('../CodeEditor'));

interface ContractTabProps {
  node: SNode;
  initialField?: string;
  initialAdvanced?: boolean;
}

export function ContractTab({ node, initialField, initialAdvanced = false }: ContractTabProps) {
  const tr = useT();
  const applyEdit = useStudio((s) => s.applyEdit);
  const emp = node.data.employee;

  const [advanced, setAdvanced] = useState(initialAdvanced || !!initialField);
  const [rawText, setRawText] = useState('');
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [highlightLine, setHighlightLine] = useState<number | undefined>(undefined);

  // Sync rawText when emp.contract changes
  useEffect(() => {
    if (emp?.contract) {
      const text = documentText('contract', emp.contract);
      setRawText(text);
      if (initialField) {
        const line = locateField(text, initialField, 'json');
        if (line >= 0) setHighlightLine(line + 1);
      }
    }
  }, [emp?.contract, initialField]);

  if (!emp) {
    return <div className="text-slate-400">{tr('inspector.error', { message: 'No contract available.' })}</div>;
  }

  const contract = emp.contract as Record<string, unknown>;
  const runtime = (contract.runtime_config ?? {}) as Record<string, unknown>;
  const authority = (contract.authority ?? {}) as Record<string, unknown>;

  const handleSaveRaw = () => {
    setErrorMsg(null);
    const res = applyEdit(node.id, (n, tid) => editDocument(n, tid, 'contract', rawText));
    if (!res.ok) {
      setErrorMsg(`[${res.code}] ${res.message}`);
      if (res.line) setHighlightLine(res.line);
    } else {
      setIssues(res.issues);
      setErrorMsg(null);
    }
  };

  const handleIssueClick = (path: string) => {
    const line = locateField(rawText, path, 'json');
    if (line >= 0) setHighlightLine(line + 1);
  };

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          contract.json (§2.1.1, §2.2.1)
        </h3>
        <button
          onClick={() => setAdvanced(!advanced)}
          className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-700"
        >
          {advanced ? tr('inspector.simple') : tr('inspector.advanced')}
        </button>
      </div>

      {errorMsg && (
        <div role="alert" className="rounded border border-rose-500/50 bg-rose-950/60 p-2 text-xs text-rose-300">
          {errorMsg}
        </div>
      )}

      {issues.length > 0 && (
        <div className="rounded border border-amber-500/50 bg-amber-950/60 p-2 text-xs">
          <div className="font-semibold text-amber-300">{tr('inspector.issues', { n: issues.length })}:</div>
          <ul className="mt-1 space-y-1">
            {issues.map((iss, i) => (
              <li key={i}>
                <button
                  onClick={() => handleIssueClick(iss.path)}
                  className="text-start text-amber-200 hover:underline"
                >
                  <span className="font-mono text-amber-400">{iss.path || 'root'}</span>: {iss.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {advanced ? (
        <div className="space-y-3">
          <Suspense fallback={<div className="h-64 rounded bg-slate-900 text-slate-500 p-4">Loading editor…</div>}>
            <CodeEditor
              value={rawText}
              onChange={setRawText}
              language="json"
              height="360px"
              highlightLine={highlightLine}
            />
          </Suspense>
          <div className="flex justify-between items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Validates against contract.schema.json (Draft 2020-12)</span>
              {rawText !== (emp.contract ? documentText('contract', emp.contract) : '') && (
                <span className="flex items-center gap-1 rounded bg-amber-950/80 border border-amber-700/60 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  {tr('inspector.unsaved')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (emp.contract) setRawText(documentText('contract', emp.contract));
                }}
                disabled={rawText === (emp.contract ? documentText('contract', emp.contract) : '')}
                className="rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-colors"
              >
                {tr('inspector.reset_default')}
              </button>
              <button
                onClick={handleSaveRaw}
                className="rounded bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 transition-colors"
              >
                {tr('inspector.save')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded border border-slate-800 bg-slate-900/60 p-3">
          <div>
            <label className="text-xs text-slate-400">Employee ID</label>
            <div className="mt-1 font-mono text-xs text-sky-400">{String(contract.employee_id ?? '')}</div>
          </div>
          <div>
            <label className="text-xs text-slate-400">Role & Department</label>
            <div className="mt-1 text-xs text-slate-300">
              {String(contract.role ?? '')} · {String(contract.department ?? '')}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400">Mission</label>
            <textarea
              defaultValue={String(contract.mission ?? '')}
              onBlur={(e) => {
                applyEdit(node.id, (n, tid) => setIdentity(n, tid, { mission: e.target.value }));
              }}
              rows={2}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-slate-400">Autonomy Level</label>
              <div className="mt-1 font-mono text-slate-200">{String(authority.autonomy_level ?? 1)}</div>
            </div>
            <div>
              <label className="text-slate-400">Docker Network</label>
              <div className="mt-1 font-mono text-slate-200">{String(runtime.docker_network ?? 'internal')}</div>
            </div>
            <div>
              <label className="text-slate-400">Task Timeout (s)</label>
              <input
                type="number"
                min="1"
                defaultValue={Number(runtime.task_timeout_seconds ?? 60)}
                onBlur={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (val > 0) applyEdit(node.id, (n, tid) => setRuntimeLimits(n, tid, { task_timeout_seconds: val }));
                }}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100"
              />
            </div>
            <div>
              <label className="text-slate-400">Max Concurrent Tasks</label>
              <input
                type="number"
                min="1"
                defaultValue={Number(runtime.max_concurrent_tasks ?? 5)}
                onBlur={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (val > 0) applyEdit(node.id, (n, tid) => setRuntimeLimits(n, tid, { max_concurrent_tasks: val }));
                }}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400">Exclusions</label>
            <ul className="mt-1 list-disc ps-4 text-xs text-slate-400">
              {((contract.exclusions as string[]) ?? []).map((ex, i) => (
                <li key={i}>{ex}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
