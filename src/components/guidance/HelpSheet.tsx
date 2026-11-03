import { useState } from 'react';
import { useStudio } from '../../store/useStudioStore';
import { useModalA11y } from '../layout/useModalA11y';
import { useT } from '../../i18n/useT';
import { SHORTCUTS_TABLE } from '../layout/shortcutsData';
import { CABLE_DEFS } from '../../registry/cables';

export function HelpSheet() {
  const tr = useT();
  const lang = useStudio((s) => s.lang);
  const helpSheetOpen = useStudio((s) => s.helpSheetOpen);
  const setHelpSheetOpen = useStudio((s) => s.setHelpSheetOpen);
  const setTourOpen = useStudio((s) => s.setTourOpen);
  const [tab, setTab] = useState<'shortcuts' | 'cables' | 'glossary'>('shortcuts');

  const dialogRef = useModalA11y<HTMLDivElement>(helpSheetOpen, () => setHelpSheetOpen(false));

  if (!helpSheetOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-sheet-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-2xl max-h-[90vh] rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden="true">❓</span>
            <h2 id="help-sheet-title" className="text-base font-bold text-slate-100" dir="auto">
              {tr('help.title')}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setHelpSheetOpen(false);
                setTourOpen(true);
              }}
              className="rounded bg-sky-950 px-2.5 py-1 text-xs font-semibold text-sky-300 border border-sky-800 hover:bg-sky-900 transition-colors"
            >
              🔄 {tr('tour.replay')}
            </button>
            <button
              onClick={() => setHelpSheetOpen(false)}
              className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              aria-label={tr('inspector.close')}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 p-1 my-3 rounded-lg gap-1">
          <button
            onClick={() => setTab('shortcuts')}
            className={`flex-1 rounded py-1 text-xs font-medium transition-colors ${
              tab === 'shortcuts' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tr('help.shortcuts')}
          </button>
          <button
            onClick={() => setTab('cables')}
            className={`flex-1 rounded py-1 text-xs font-medium transition-colors ${
              tab === 'cables' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tr('help.cables')}
          </button>
          <button
            onClick={() => setTab('glossary')}
            className={`flex-1 rounded py-1 text-xs font-medium transition-colors ${
              tab === 'glossary' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tr('help.glossary')}
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {tab === 'shortcuts' && (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                {SHORTCUTS_TABLE.map((sc) => (
                  <div
                    key={sc.id}
                    className="flex items-center justify-between rounded border border-slate-800 bg-slate-950/50 p-2.5 text-xs"
                  >
                    <span className="text-slate-300 font-medium" dir="auto">
                      {lang === 'ar' ? sc.descriptionAr : sc.descriptionEn}
                    </span>
                    <kbd className="rounded bg-slate-800 border border-slate-700 px-2 py-0.5 font-mono text-[11px] text-sky-300 shadow-xs">
                      {sc.keyLabel}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'cables' && (
            <div className="space-y-2.5">
              {Object.values(CABLE_DEFS).map((c) => (
                <div
                  key={c.kind}
                  className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-8 rounded transition-all"
                        style={{
                          backgroundColor: c.color,
                          borderStyle: c.dashed ? 'dashed' : 'solid',
                        }}
                      />
                      <b className="text-xs text-slate-100">{c.label[lang] ?? c.kind}</b>
                      {c.dashed && (
                        <span className="rounded bg-slate-800 px-1.5 py-0.2 text-[10px] text-slate-400 font-mono">
                          Dashed
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-slate-500">{c.kind}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed" dir="auto">
                    {c.description[lang]}
                  </p>
                </div>
              ))}
            </div>
          )}

          {tab === 'glossary' && (
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <h3 className="font-bold text-xs text-sky-400 mb-1">Rule of Three (§2.1)</h3>
                <p className="text-xs text-slate-300 leading-relaxed" dir="auto">
                  {tr('help.glossary.rule_of_three')}
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <h3 className="font-bold text-xs text-sky-400 mb-1">Embedded PEP (§4.2)</h3>
                <p className="text-xs text-slate-300 leading-relaxed" dir="auto">
                  {tr('help.glossary.pep')}
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <h3 className="font-bold text-xs text-sky-400 mb-1">Default Deny (§4.3)</h3>
                <p className="text-xs text-slate-300 leading-relaxed" dir="auto">
                  {tr('help.glossary.default_deny')}
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <h3 className="font-bold text-xs text-sky-400 mb-1">fit_score Gates (§3.3)</h3>
                <p className="text-xs text-slate-300 leading-relaxed" dir="auto">
                  {tr('help.glossary.fit_score')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex justify-end border-t border-slate-800 pt-3">
          <button
            onClick={() => setHelpSheetOpen(false)}
            className="rounded bg-slate-800 px-4 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            {tr('inspector.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
