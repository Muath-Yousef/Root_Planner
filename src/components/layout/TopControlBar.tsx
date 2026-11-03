import { useState } from 'react';
import { HORIZONS } from '../../registry';
import { useProblems } from '../../store/useProblems';
import { errorCount } from '../../engine/problems';
import { useStudio } from '../../store/useStudioStore';
import { useT } from '../../i18n/useT';
import { useContainerWidth } from './useContainerWidth';
import type { Horizon } from '../../types';

export function TopControlBar({ onHome }: { onHome: () => void }) {
  const tr = useT();
  const { ref, width } = useContainerWidth<HTMLHeadingElement>();
  const tenant = useStudio((s) => s.tenant);
  const name = useStudio((s) => s.project.name);
  const rename = useStudio((s) => s.rename);
  const horizon = useStudio((s) => s.horizon);
  const setHorizon = useStudio((s) => s.setHorizon);
  const mode = useStudio((s) => s.mode);
  const setMode = useStudio((s) => s.setMode);
  const theme = useStudio((s) => s.theme);
  const setTheme = useStudio((s) => s.setTheme);
  const lang = useStudio((s) => s.lang);
  const setLang = useStudio((s) => s.setLang);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const canUndo = useStudio((s) => s.history.past.length > 0);
  const canRedo = useStudio((s) => s.history.future.length > 0);
  const autoLayoutCanvas = useStudio((s) => s.autoLayoutCanvas);
  const alignSelected = useStudio((s) => s.alignSelected);
  const distributeSelected = useStudio((s) => s.distributeSelected);
  const setCliModalOpen = useStudio((s) => s.setCliModalOpen);
  const setBreakGlassModalOpen = useStudio((s) => s.setBreakGlassModalOpen);
  const setTenantModalOpen = useStudio((s) => s.setTenantModalOpen);
  const setExportModalOpen = useStudio((s) => s.setExportModalOpen);
  const setKillModalOpen = useStudio((s) => s.setKillModalOpen);
  const setCommandPaletteOpen = useStudio((s) => s.setCommandPaletteOpen);
  const setConfigEditorModalOpen = useStudio((s) => s.setConfigEditorModalOpen);
  const setHelpSheetOpen = useStudio((s) => s.setHelpSheetOpen);

  const problems = useProblems();
  const errors = errorCount(problems);

  const [moreOpen, setMoreOpen] = useState(false);

  const isCompact = width < 850;
  const isMedium = width < 1100;

  const btn =
    'rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-40 transition-colors flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-sky-500';

  return (
    <header
      ref={ref}
      className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 bg-slate-900 px-3 py-2 text-xs select-none"
    >
      {/* Cluster 1: Project & Tenant */}
      <div className="flex items-center gap-2" role="group" aria-label={tr('top.cluster.project')}>
        <button onClick={onHome} className={btn} title={tr('top.title.home')} aria-label={tr('top.home')}>
          <span>🏠</span>
          {!isMedium && <span>{tr('top.home')}</span>}
        </button>

        <input
          value={name}
          onChange={(e) => rename(e.target.value)}
          aria-label={tr('top.project')}
          className="w-32 sm:w-40 rounded bg-slate-800 px-2 py-1 font-semibold text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />

        <button
          onClick={() => setTenantModalOpen(true)}
          className="rounded border border-slate-600 bg-slate-800/80 px-2 py-0.5 text-xs text-slate-300 hover:border-sky-400 hover:text-sky-300 transition-colors font-mono"
          dir="ltr"
          title={tr('top.title.tenant')}
        >
          {tenant.tenant_id}
        </button>
      </div>

      {/* Cluster 2: Edit & History */}
      {!isCompact && (
        <div className="flex items-center gap-1 border-s border-slate-800 ps-2" role="group" aria-label={tr('top.cluster.edit')}>
          <button onClick={undo} disabled={!canUndo} className={btn} title={tr('top.title.undo')} aria-label={tr('top.undo')}>
            <span>↩</span>
            {!isMedium && <span>{tr('top.undo')}</span>}
          </button>
          <button onClick={redo} disabled={!canRedo} className={btn} title={tr('top.title.redo')} aria-label={tr('top.redo')}>
            <span>↪</span>
            {!isMedium && <span>{tr('top.redo')}</span>}
          </button>
        </div>
      )}

      {/* Cluster 3: Layout */}
      {!isCompact && (
        <div className="flex items-center gap-1 border-s border-slate-800 ps-2" role="group" aria-label={tr('top.cluster.layout')}>
          <button onClick={autoLayoutCanvas} className={btn} title={tr('top.title.autolayout')} aria-label={tr('top.autolayout')}>
            <span>📐</span>
            {!isMedium && <span>{tr('top.autolayout')}</span>}
          </button>
        </div>
      )}

      {/* Cluster 4: Operations */}
      <div className="flex items-center gap-1 border-s border-slate-800 ps-2" role="group" aria-label={tr('top.cluster.operations')}>
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="rounded bg-sky-950 px-2 py-1 text-xs font-medium text-sky-300 hover:bg-sky-900 flex items-center gap-1 border border-sky-800/60"
          title={tr('top.title.palette')}
          aria-label={tr('top.palette')}
        >
          <span>⌘</span>
          {!isMedium && <span>{tr('top.palette')}</span>}
          <kbd className="text-[10px] opacity-70">⌘K</kbd>
        </button>

        {!isCompact && (
          <>
            <button onClick={() => setCliModalOpen(true)} className={btn} title={tr('top.title.cli')} aria-label={tr('top.cli')}>
              <span>💻</span>
              {!isMedium && <span>{tr('top.cli')}</span>}
            </button>
            <button onClick={() => setBreakGlassModalOpen(true)} className={btn} title={tr('top.title.breakglass')} aria-label={tr('top.breakglass')}>
              <span>🔨</span>
              {!isMedium && <span>{tr('top.breakglass')}</span>}
            </button>
            <button onClick={() => setConfigEditorModalOpen(true)} className={btn} title={tr('top.title.configs')} aria-label={tr('top.configs')}>
              <span>⚙</span>
              {!isMedium && <span>{tr('top.configs')}</span>}
            </button>
          </>
        )}

        {/* Kill Plane - ALWAYS DISTINCT & VISIBLE */}
        <button
          onClick={() => setKillModalOpen(true)}
          className="rounded bg-rose-950 px-2 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-900 border border-rose-800 shadow-xs flex items-center gap-1"
          title={tr('top.title.killplane')}
          aria-label={tr('top.killplane')}
        >
          <span>🛑</span>
          <span>{tr('top.killplane')}</span>
        </button>
      </div>

      {/* Low priority overflow menu for narrow width */}
      {isCompact && (
        <div className="relative">
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className="rounded bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-200 hover:bg-slate-700"
            aria-label={tr('top.more')}
          >
            {tr('top.more')} ▾
          </button>

          {moreOpen && (
            <div
              onClick={() => setMoreOpen(false)}
              className="absolute top-full end-0 mt-1 z-50 w-48 rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-xl space-y-1 text-xs"
            >
              <button onClick={undo} disabled={!canUndo} className="w-full text-start p-1.5 rounded hover:bg-slate-800 disabled:opacity-40">
                ↩ {tr('top.undo')}
              </button>
              <button onClick={redo} disabled={!canRedo} className="w-full text-start p-1.5 rounded hover:bg-slate-800 disabled:opacity-40">
                ↪ {tr('top.redo')}
              </button>
              <button onClick={autoLayoutCanvas} className="w-full text-start p-1.5 rounded hover:bg-slate-800">
                📐 {tr('top.autolayout')}
              </button>
              <button onClick={() => setCliModalOpen(true)} className="w-full text-start p-1.5 rounded hover:bg-slate-800">
                💻 {tr('top.cli')}
              </button>
              <button onClick={() => setBreakGlassModalOpen(true)} className="w-full text-start p-1.5 rounded hover:bg-slate-800">
                🔨 {tr('top.breakglass')}
              </button>
              <button onClick={() => setConfigEditorModalOpen(true)} className="w-full text-start p-1.5 rounded hover:bg-slate-800">
                ⚙ {tr('top.configs')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Cluster 5: View, Mode & Export */}
      <div className="ms-auto flex items-center gap-2" role="group" aria-label={tr('top.cluster.view')}>
        {/* Horizon selector */}
        <label className="text-xs text-slate-400 hidden sm:flex items-center">
          {tr('top.horizon')}
          <select
            value={horizon}
            onChange={(e) => setHorizon(e.target.value as Horizon)}
            className="ms-1 rounded bg-slate-800 px-2 py-1 text-xs text-slate-100 font-mono"
            dir="ltr"
          >
            {HORIZONS.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
        </label>

        {/* Mode switch */}
        <div className="flex overflow-hidden rounded border border-slate-600" role="group">
          {(['design', 'simulate'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`px-2.5 py-1 font-medium transition-colors ${
                mode === m ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {tr(m === 'design' ? 'top.mode.design' : 'top.mode.simulate')}
            </button>
          ))}
        </div>

        {/* Export Button */}
        <button
          onClick={() => setExportModalOpen(true)}
          disabled={errors > 0}
          title={errors > 0 ? tr('export.blocked', { n: errors }) : undefined}
          aria-label={tr('top.export')}
          className="rounded bg-emerald-700 px-3 py-1 font-semibold text-white hover:bg-emerald-600 disabled:opacity-40 transition-colors shadow-xs"
        >
          {tr('top.export')}
        </button>

        {/* Help Sheet Button */}
        <button
          onClick={() => setHelpSheetOpen(true)}
          className="rounded bg-slate-800 px-2 py-1 text-xs font-bold text-sky-400 hover:bg-slate-700 hover:text-sky-300 transition-colors"
          title={tr('top.help')}
          aria-label={tr('top.help')}
        >
          ❓
        </button>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className={btn}
          title={tr('top.title.theme')}
          aria-label={tr('top.title.theme')}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        {/* Language switch */}
        <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className={btn} aria-label={tr('top.lang')}>
          {tr('top.lang')}
        </button>
      </div>
    </header>
  );
}
