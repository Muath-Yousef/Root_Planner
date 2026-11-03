import { useState, useEffect, lazy, Suspense } from 'react';
import type { SNode } from '../../../types';
import { editDocument, documentText, locateField } from '../../../engine/inspectorEdit';
import type { ValidationIssue } from '../../../schemas/validator';
import { useStudio } from '../../../store/useStudioStore';
import { useT } from '../../../i18n/useT';

const CodeEditor = lazy(() => import('../CodeEditor'));

interface ManifestTabProps {
  node: SNode;
  initialField?: string;
  initialAdvanced?: boolean;
}

export function ManifestTab({ node, initialField, initialAdvanced = false }: ManifestTabProps) {
  const tr = useT();
  const applyEdit = useStudio((s) => s.applyEdit);
  const emp = node.data.employee;

  const [advanced, setAdvanced] = useState(initialAdvanced || !!initialField);
  const [rawText, setRawText] = useState('');
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [highlightLine, setHighlightLine] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (emp?.manifest) {
      const text = documentText('manifest', emp.manifest);
      setRawText(text);
      if (initialField) {
        const line = locateField(text, initialField, 'yaml');
        if (line >= 0) setHighlightLine(line + 1);
      }
    }
  }, [emp?.manifest, initialField]);

  if (!emp) {
    return <div className="text-slate-400">{tr('inspector.error', { message: 'No manifest available.' })}</div>;
  }

  const manifest = emp.manifest as Record<string, unknown>;
  const meta = (manifest.metadata ?? {}) as Record<string, unknown>;
  const spec = (manifest.spec ?? {}) as Record<string, unknown>;
  const runtime = (spec.runtime ?? {}) as Record<string, unknown>;
  const network = (spec.network ?? {}) as Record<string, unknown>;
  const resources = (spec.resources ?? {}) as Record<string, unknown>;
  const health = (spec.health_check ?? {}) as Record<string, unknown>;
  const kill = (spec.kill_switch ?? {}) as Record<string, unknown>;

  const handleSaveRaw = () => {
    setErrorMsg(null);
    const res = applyEdit(node.id, (n, tid) => editDocument(n, tid, 'manifest', rawText));
    if (!res.ok) {
      setErrorMsg(`[${res.code}] ${res.message}`);
      if (res.line) setHighlightLine(res.line);
    } else {
      setIssues(res.issues);
      setErrorMsg(null);
    }
  };

  const handleIssueClick = (path: string) => {
    const line = locateField(rawText, path, 'yaml');
    if (line >= 0) setHighlightLine(line + 1);
  };

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          manifest.yaml (§2.1.2, §2.2.2)
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
              language="yaml"
              height="360px"
              highlightLine={highlightLine}
            />
          </Suspense>
          <div className="flex justify-between items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Validates against manifest.schema.json (Draft 2020-12)</span>
              {rawText !== (emp.manifest ? documentText('manifest', emp.manifest) : '') && (
                <span className="flex items-center gap-1 rounded bg-amber-950/80 border border-amber-700/60 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  {tr('inspector.unsaved')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (emp.manifest) setRawText(documentText('manifest', emp.manifest));
                }}
                disabled={rawText === (emp.manifest ? documentText('manifest', emp.manifest) : '')}
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
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-slate-400">API Version</label>
              <div className="mt-1 font-mono text-slate-200">{String(manifest.apiVersion ?? 'apps/v1')}</div>
            </div>
            <div>
              <label className="text-slate-400">Kind</label>
              <div className="mt-1 font-mono text-slate-200">{String(manifest.kind ?? 'EmployeeManifest')}</div>
            </div>
            <div>
              <label className="text-slate-400">Runtime Image</label>
              <div className="mt-1 font-mono text-sky-400 truncate">{String(runtime.image ?? '')}</div>
            </div>
            <div>
              <label className="text-slate-400">Network Mode</label>
              <div className="mt-1 font-mono text-slate-200">{String(network.mode ?? 'internal')}</div>
            </div>
            <div>
              <label className="text-slate-400">CPU Limit</label>
              <div className="mt-1 font-mono text-slate-200">{String(resources.cpu_limit ?? '1000m')}</div>
            </div>
            <div>
              <label className="text-slate-400">Memory Limit</label>
              <div className="mt-1 font-mono text-slate-200">{String(resources.memory_limit ?? '512Mi')}</div>
            </div>
            <div>
              <label className="text-slate-400">Health Endpoint</label>
              <div className="mt-1 font-mono text-slate-200">{String(health.endpoint ?? '/health')}</div>
            </div>
            <div>
              <label className="text-slate-400">Health Interval</label>
              <div className="mt-1 font-mono text-slate-200">{String(health.interval_seconds ?? 30)}s</div>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400">Kill Switch Auto Triggers</label>
            <ul className="mt-1 space-y-1 text-xs">
              {((kill.auto_triggers as Array<{ condition: string; level: string; action: string }>) ?? []).map((trig, i) => (
                <li key={i} className="flex justify-between rounded bg-slate-800 px-2 py-1 font-mono text-[11px]">
                  <span className="text-amber-400">{trig.condition}</span>
                  <span className="text-rose-400">{trig.level} → {trig.action}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
