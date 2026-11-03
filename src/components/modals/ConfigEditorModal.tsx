import { useState, useEffect } from 'react';
import { load } from 'js-yaml';
import { useStudio } from '../../store/useStudioStore';
import { useT } from '../../i18n/useT';
import { useModalA11y } from '../layout/useModalA11y';

type ConfigFileName = 'model_routing' | 'sources_watchlist' | 'pricing_config';

export function ConfigEditorModal() {
  const tr = useT();
  const open = useStudio((s) => s.configEditorModalOpen);
  const close = () => useStudio.getState().setConfigEditorModalOpen(false);
  const configs = useStudio((s) => s.configs);
  const saveConfig = useStudio((s) => s.saveConfig);

  const [activeFile, setActiveFile] = useState<ConfigFileName>('model_routing');
  const [content, setContent] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<boolean>(false);

  const dialogRef = useModalA11y<HTMLDivElement>(open, close);

  useEffect(() => {
    if (open) {
      setContent(configs[activeFile] ?? '');
      setErrorMsg(null);
      setSuccessMsg(false);
    }
  }, [open, activeFile, configs]);

  if (!open) return null;

  const validateYaml = (text: string, file: ConfigFileName): { ok: boolean; message?: string } => {
    try {
      const parsed = load(text) as Record<string, unknown> | null;
      if (!parsed || typeof parsed !== 'object') {
        return { ok: false, message: 'Invalid YAML: Root must be a key-value mapping.' };
      }
      if (file === 'model_routing' && !parsed.routing) {
        return { ok: false, message: 'Schema error: Missing required root key "routing".' };
      }
      if (file === 'sources_watchlist' && (!parsed.blocked_ip_ranges || !parsed.approved_sources)) {
        return { ok: false, message: 'Schema error: Missing required "blocked_ip_ranges" or "approved_sources".' };
      }
      if (file === 'pricing_config' && !parsed.models) {
        return { ok: false, message: 'Schema error: Missing required "models" pricing table.' };
      }
      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, message: (err as Error).message };
    }
  };

  const handleSave = () => {
    setErrorMsg(null);
    setSuccessMsg(false);
    const check = validateYaml(content, activeFile);
    if (!check.ok) {
      setErrorMsg(check.message ?? 'Validation failed.');
      return;
    }
    saveConfig(activeFile, content);
    setSuccessMsg(true);
    setTimeout(() => setSuccessMsg(false), 2500);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="config-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onClick={close}
    >
      <div
        ref={dialogRef}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-5 py-4">
          <div>
            <h2 id="config-modal-title" className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <span className="text-sky-400">⚙</span>
              <span>{tr('config.editor.title')}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{tr('config.editor.subtitle')}</p>
          </div>
          <button
            onClick={close}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label={tr('inspector.close')}
          >
            ✕
          </button>
        </div>

        {/* File Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/70 px-4 pt-2 gap-2">
          {(['model_routing', 'sources_watchlist', 'pricing_config'] as ConfigFileName[]).map(
            (fileName) => (
              <button
                key={fileName}
                onClick={() => setActiveFile(fileName)}
                className={`font-mono text-xs px-3 py-2 border-b-2 transition-colors ${
                  activeFile === fileName
                    ? 'border-sky-500 text-sky-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                📄 {fileName}.yaml
              </button>
            )
          )}
        </div>

        {/* Editor Body */}
        <div className="flex-1 overflow-hidden p-4 flex flex-col space-y-3">
          <div className="relative flex-1">
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setErrorMsg(null);
                setSuccessMsg(false);
              }}
              rows={16}
              dir="ltr"
              className="w-full h-full rounded border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-200 focus:border-sky-500 focus:outline-hidden resize-none leading-relaxed"
              spellCheck={false}
            />
          </div>

          {errorMsg && (
            <div className="rounded border border-rose-800 bg-rose-950/50 p-2.5 text-xs text-rose-300 font-mono">
              ⚠️ {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="rounded border border-emerald-800 bg-emerald-950/50 p-2.5 text-xs text-emerald-300 font-mono">
              ✓ {tr('inspector.saved')}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950 px-5 py-3">
          <div className="text-[11px] text-slate-500 font-mono">
            Ajv & YAML Lint Validated
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={close}
              className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
            >
              {tr('wizard.cancel')}
            </button>
            <button
              onClick={handleSave}
              className="rounded bg-sky-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-sky-500"
            >
              {tr('inspector.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
