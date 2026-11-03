import { useEffect, useRef, useState } from 'react';
import { createProject, START_TEMPLATES } from '../../presets/startTemplates';
import { deleteProject, listProjects, loadProject, type ProjectSummary } from '../../persistence/projectStore';
import { importProjectFile, openProject } from '../../store/projectActions';
import { useStudio } from '../../store/useStudioStore';
import { useT } from '../../i18n/useT';
import type { ProjectFile } from '../../types';
import { NewCompanyWizard } from './NewCompanyWizard';
import { ConfirmDialog } from '../common/ConfirmDialog';

/** First screen: ready-made starting points, the 3-step wizard, saved companies and file import. The canvas is never opened empty by surprise. */
export function StartScreen({ onOpen }: { onOpen: () => void }) {
  const tr = useT();
  const lang = useStudio((s) => s.lang), setLang = useStudio((s) => s.setLang);
  const notify = useStudio((s) => s.notify);
  const [saved, setSaved] = useState<ProjectSummary[] | null>(null);
  const [wizard, setWizard] = useState(false);
  const [msg, setMsg] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const refresh = () => { void listProjects().then(setSaved); };
  useEffect(refresh, []);

  const open = async (p: ProjectFile) => { await openProject(p); onOpen(); };
  const fromTemplate = (i: number) => {
    const t = START_TEMPLATES[i]; const r = createProject({ name: t.label.en, tenant_id: t.tenant_id, template: t.id });
    if (r.ok) void open(r.project); else setMsg(r.message[lang]);
  };
  const openSaved = async (id: string) => { const p = await loadProject(id); if (p) { useStudio.getState().loadProject(p); onOpen(); } };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const r = await importProjectFile(f);
    if (!r.ok) {
      setMsg(tr('import.failed', { message: r.message }));
      notify('error', tr('import.failed', { message: r.message }));
      return;
    }
    notify('success', tr('toast.import_success'));
    onOpen();
  };
  return (
    <main className="mx-auto flex h-full max-w-4xl flex-col gap-6 overflow-y-auto p-6">
      <header className="flex items-center gap-3">
        <div><h1 className="text-xl font-bold">{tr('app.title')}</h1><p className="text-sm text-slate-300">{tr('start.subtitle')}</p></div>
        <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="ms-auto rounded bg-slate-800 px-2 py-1 text-sm text-slate-200">{tr('top.lang')}</button>
      </header>
      <section aria-label={tr('start.title')} className="grid gap-3 sm:grid-cols-2">
        {START_TEMPLATES.map((t, i) => (
          <button key={t.id} onClick={() => fromTemplate(i)} className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-start hover:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500">
            <b>{t.label[lang]}</b><p className="mt-1 text-xs text-slate-300">{t.description[lang]}</p><p className="mt-2 text-[11px] text-slate-400" dir="ltr">{t.tenant_id} · {t.horizon}</p>
          </button>
        ))}
      </section>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setWizard(true)} className="rounded bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-400">{tr('start.new')}</button>
        <button onClick={() => file.current?.click()} className="rounded bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400">{tr('start.import')}</button>
        <input ref={file} type="file" accept=".json,.socroot.json,application/json" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {msg && <p role="alert" className="text-sm text-rose-400">{msg}</p>}
      <section aria-label={tr('start.saved')}>
        <h2 className="mb-2 font-semibold text-slate-200">{tr('start.saved')}</h2>
        {saved === null ? <p className="text-sm text-slate-400">{tr('start.loading')}</p> : saved.length === 0 ? <p className="text-sm text-slate-400">{tr('start.none')}</p> : (
          <ul className="space-y-1">
            {saved.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded border border-slate-700 px-3 py-2 text-sm">
                <b dir="auto">{p.name}</b><span className="text-xs text-slate-400" dir="ltr">{p.tenant_id}</span>
                <button onClick={() => void openSaved(p.id)} className="ms-auto rounded bg-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400">{tr('start.open')}</button>
                <button
                  onClick={() => setProjectToDelete({ id: p.id, name: p.name })}
                  className="rounded bg-rose-900 px-2 py-1 text-xs text-rose-200 hover:bg-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-400"
                >
                  {tr('start.delete')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {wizard && <NewCompanyWizard onCancel={() => setWizard(false)} onCreate={(p) => { setWizard(false); void open(p); }} />}

      <ConfirmDialog
        isOpen={!!projectToDelete}
        title={tr('confirm.delete_project.title')}
        description={tr('confirm.delete_project.desc', { name: projectToDelete?.name ?? '' })}
        confirmLabel={tr('start.delete')}
        cancelLabel={tr('confirm.cancel')}
        isDestructive={true}
        onConfirm={async () => {
          if (projectToDelete) {
            await deleteProject(projectToDelete.id);
            refresh();
            notify('info', tr('toast.deleted', { n: 1 }));
            setProjectToDelete(null);
          }
        }}
        onCancel={() => setProjectToDelete(null)}
      />
    </main>
  );
}
