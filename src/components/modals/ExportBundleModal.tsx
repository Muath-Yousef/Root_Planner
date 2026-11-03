import { useState, useMemo } from 'react';
import { useStudio } from '../../store/useStudioStore';
import { planBundle, buildBundle } from '../../engine/bundleExporter';
import { zipBundle } from '../../engine/zipBundle';
import { useProblems } from '../../store/useProblems';
import { errorCount } from '../../engine/problems';
import { useT } from '../../i18n/useT';
import { useModalA11y } from '../layout/useModalA11y';

const download = (blob: Blob, name: string) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

export function ExportBundleModal() {
  const tr = useT();
  const exportModalOpen = useStudio((s) => s.exportModalOpen);
  const setExportModalOpen = useStudio((s) => s.setExportModalOpen);
  const nodes = useStudio((s) => s.nodes);
  const edges = useStudio((s) => s.edges);
  const configs = useStudio((s) => s.configs);
  const tenant_id = useStudio((s) => s.tenant_id);
  const projectName = useStudio((s) => s.project.name);

  const [busy, setBusy] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const dialogRef = useModalA11y<HTMLDivElement>(exportModalOpen, () => setExportModalOpen(false));

  const problems = useProblems();
  const errors = errorCount(problems);

  const plan = useMemo(() => {
    return planBundle(nodes, configs);
  }, [nodes, configs]);

  const bundleResult = useMemo(() => {
    return buildBundle(nodes, edges, configs, tenant_id);
  }, [nodes, edges, configs, tenant_id]);

  if (!exportModalOpen) return null;

  const handleDownload = async () => {
    if (errors > 0 || !bundleResult.ok) return;
    setBusy(true);
    setDownloadError(null);
    try {
      const blob = await zipBundle(bundleResult.bundle.files);
      const safeName = projectName.replace(/[^A-Za-z0-9._-]+/g, '_') || 'socroot';
      download(blob, `${safeName}.zip`);
      setExportModalOpen(false);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-bundle-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-5 py-4">
          <div>
            <div className="text-xs font-mono font-semibold text-emerald-400 uppercase tracking-wider">
              {tr('export.title')}
            </div>
            <h2 id="export-bundle-modal-title" className="text-sm font-bold text-slate-100">
              Production Bundle Exporter (§1.4.3, §2.1, ORG-003)
            </h2>
          </div>
          <button
            onClick={() => setExportModalOpen(false)}
            aria-label={tr('inspector.close')}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
          {downloadError && (
            <div role="alert" className="rounded border border-rose-500/50 bg-rose-950/60 p-2 text-rose-300">
              {downloadError}
            </div>
          )}

          {/* Validation Status Gate */}
          {errors > 0 ? (
            <div className="rounded border border-rose-600/60 bg-rose-950/40 p-3 text-xs space-y-1">
              <div className="font-bold text-rose-300">Export Blocked by Validation Errors</div>
              <p className="text-rose-200/90">
                {tr('export.blocked', { n: errors })}
              </p>
              {!bundleResult.ok && bundleResult.errors.length > 0 && (
                <div className="mt-1 font-mono text-[11px] text-rose-300">
                  First error: <strong className="text-rose-400">{bundleResult.errors[0].code}</strong> —{' '}
                  {bundleResult.errors[0].message}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded border border-emerald-600/50 bg-emerald-950/40 p-2.5 text-emerald-300 font-semibold">
              ✓ Ready for production export: 0 errors detected.
            </div>
          )}

          {/* Summary Box */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 space-y-2">
            <h3 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
              {tr('export.summary')}
            </h3>
            <div className="grid grid-cols-2 gap-2 text-slate-300">
              <div>
                <span className="text-slate-400">Digital Employees: </span>
                <span className="font-bold text-sky-400">{plan.employees}</span>
              </div>
              <div>
                <span className="text-slate-400">Total Files in ZIP: </span>
                <span className="font-bold text-emerald-400">{plan.files.length}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400">Implemented Departments: </span>
                <span className="font-mono text-slate-200">
                  {plan.departments.length ? plan.departments.join(', ') : '(none)'}
                </span>
              </div>
            </div>
          </div>

          {/* Skipped Items (ORG-003) */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                {tr('export.skipped.title')}
              </h3>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-amber-400">
                {plan.skipped.length} skipped
              </span>
            </div>

            {plan.skipped.length === 0 ? (
              <p className="text-slate-400 text-xs">No employees skipped.</p>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {plan.skipped.map((s, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded border border-slate-800 bg-slate-900 p-1.5 font-mono text-[11px]"
                  >
                    <span className="text-slate-300">{s.employee_id}</span>
                    <span className="text-amber-400 text-[10px]">{s.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between border-t border-slate-800 bg-slate-950 px-5 py-3">
          <button
            onClick={() => setExportModalOpen(false)}
            className="rounded bg-slate-800 px-4 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
          >
            {tr('wizard.cancel')}
          </button>
          <button
            disabled={errors > 0 || busy}
            onClick={handleDownload}
            className="rounded bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-40"
          >
            {busy ? tr('top.exporting') : tr('export.download')}
          </button>
        </div>
      </div>
    </div>
  );
}
