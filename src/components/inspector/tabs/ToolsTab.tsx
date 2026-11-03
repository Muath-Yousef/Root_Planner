import { useState } from 'react';
import type { SNode } from '../../../types';
import { addSecret, setSecretRef, removeSecret, setRuntimeLimits } from '../../../engine/inspectorEdit';
import { useStudio } from '../../../store/useStudioStore';
import { useT } from '../../../i18n/useT';

interface ToolsTabProps {
  node: SNode;
}

export function ToolsTab({ node }: ToolsTabProps) {
  const tr = useT();
  const applyEdit = useStudio((s) => s.applyEdit);
  const emp = node.data.employee;

  const [newSecretName, setNewSecretName] = useState('');
  const [newSecretRef, setNewSecretRef] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editRefVal, setEditRefVal] = useState('');

  if (!emp) {
    return <div className="text-slate-400">{tr('inspector.error', { message: 'No tools available.' })}</div>;
  }

  const contract = emp.contract as Record<string, unknown>;
  const tools = ((contract.tools as Array<{ tool_id: string; description: string; is_idempotent: boolean }>) ?? []);
  const runtime = (contract.runtime_config ?? {}) as Record<string, unknown>;

  const handleAddSecret = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const res = applyEdit(node.id, (n, tid) => addSecret(n, tid, newSecretName, newSecretRef));
    if (!res.ok) {
      setErrorMsg(`[${res.code}] ${res.message}`);
    } else {
      setNewSecretName('');
      setNewSecretRef('');
    }
  };

  const handleSaveEditSecret = (index: number) => {
    setErrorMsg(null);
    const res = applyEdit(node.id, (n, tid) => setSecretRef(n, tid, index, editRefVal));
    if (!res.ok) {
      setErrorMsg(`[${res.code}] ${res.message}`);
    } else {
      setEditingIndex(null);
    }
  };

  const handleRemoveSecret = (index: number) => {
    setErrorMsg(null);
    const res = applyEdit(node.id, (n, tid) => removeSecret(n, tid, index));
    if (!res.ok) {
      setErrorMsg(`[${res.code}] ${res.message}`);
    }
  };

  return (
    <div className="space-y-5 text-sm">
      {errorMsg && (
        <div role="alert" className="rounded border border-rose-500/50 bg-rose-950/60 p-2.5 text-xs text-rose-300">
          <div className="font-semibold text-rose-200">Security / Validation Error</div>
          <p className="mt-0.5">{errorMsg}</p>
        </div>
      )}

      {/* Secrets Management (SEC-001) */}
      <section className="space-y-3 rounded border border-slate-800 bg-slate-900/60 p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {tr('inspector.secrets')}
          </h3>
          <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-amber-400">
            vault:// references only
          </span>
        </div>

        <p className="text-xs text-slate-400">
          SEC-001: Plaintext secrets are strictly forbidden. Every secret must use a canonical{' '}
          <code className="text-sky-300">vault://&lt;scope&gt;/&lt;key&gt;</code> reference.
        </p>

        {/* Existing Secrets */}
        <div className="space-y-2">
          {emp.secrets.map((sec, idx) => (
            <div key={idx} className="rounded border border-slate-700/60 bg-slate-800/80 p-2 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono font-semibold text-sky-400">{sec.name}</span>
                <div className="flex gap-2">
                  {editingIndex === idx ? (
                    <button
                      onClick={() => handleSaveEditSecret(idx)}
                      className="text-xs text-emerald-400 hover:underline"
                    >
                      Save
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingIndex(idx);
                        setEditRefVal(sec.ref);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-200"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveSecret(idx)}
                    className="text-xs text-rose-400 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {editingIndex === idx ? (
                <div className="flex gap-2">
                  <input
                    value={editRefVal}
                    onChange={(e) => setEditRefVal(e.target.value)}
                    className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-100"
                  />
                </div>
              ) : (
                <div className="font-mono text-[11px] text-slate-300 break-all">{sec.ref}</div>
              )}
            </div>
          ))}

          {emp.secrets.length === 0 && (
            <p className="text-xs italic text-slate-500">No secrets defined for this employee.</p>
          )}
        </div>

        {/* Add Secret Form */}
        <form onSubmit={handleAddSecret} className="space-y-2 border-t border-slate-800 pt-3">
          <div className="text-xs font-medium text-slate-300">{tr('inspector.secrets.add')}</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              placeholder="e.g. SOURCE_API_KEY"
              value={newSecretName}
              onChange={(e) => setNewSecretName(e.target.value)}
              className="rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
            />
            <input
              placeholder="vault://depts/opp_acq/key"
              value={newSecretRef}
              onChange={(e) => setNewSecretRef(e.target.value)}
              className="rounded border border-slate-700 bg-slate-800 px-2.5 py-1 font-mono text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!newSecretName || !newSecretRef}
            className="rounded bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-40"
          >
            {tr('inspector.secrets.add')}
          </button>
        </form>
      </section>

      {/* Tools List */}
      <section className="space-y-3 rounded border border-slate-800 bg-slate-900/60 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Deterministic Tools ({tools.length})
        </h3>
        <div className="space-y-2">
          {tools.map((t, i) => (
            <div key={i} className="rounded border border-slate-800 bg-slate-800/60 p-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono font-semibold text-emerald-400">{t.tool_id}</span>
                {t.is_idempotent && (
                  <span className="rounded bg-emerald-950 px-1.5 py-0.5 text-[10px] text-emerald-300">
                    Idempotent
                  </span>
                )}
              </div>
              <p className="mt-1 text-slate-300 text-[11px]">{t.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
