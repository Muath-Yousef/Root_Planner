import { useState } from 'react';
import { createProject, START_TEMPLATES, type TemplateId } from '../../presets/startTemplates';
import { TENANT_PROFILES, TENANT_ID_RE } from '../../presets/tenantProfiles';
import { useStudio } from '../../store/useStudioStore';
import { useT } from '../../i18n/useT';
import type { ProjectFile } from '../../types';
import { useModalA11y } from '../layout/useModalA11y';

const CUSTOM = '__custom__';

/** Three steps: name → tenant → starting layout. Validation lives in `createProject` (pure); this component only collects input. */
export function NewCompanyWizard({ onCreate, onCancel }: { onCreate: (p: ProjectFile) => void; onCancel: () => void }) {
  const tr = useT();
  const lang = useStudio((s) => s.lang);
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [tenantChoice, setTenantChoice] = useState(TENANT_PROFILES[0]?.tenant_id ?? CUSTOM);
  const [custom, setCustom] = useState('');
  const [template, setTemplate] = useState<TemplateId>('reference');
  const [error, setError] = useState('');
  const tenant_id = tenantChoice === CUSTOM ? custom.trim() : tenantChoice;

  const dialogRef = useModalA11y<HTMLDivElement>(true, onCancel);

  const next = () => {
    setError('');
    if (step === 1 && !name.trim()) return setError(lang === 'ar' ? 'أعطِ الشركة اسماً.' : 'Give the company a name.');
    if (step === 2 && !TENANT_ID_RE.test(tenant_id)) return setError(createError());
    setStep(step + 1);
  };
  const createError = () => { const r = createProject({ name: 'x', tenant_id, template: 'blank' }); return r.ok ? '' : r.message[lang]; };
  const create = () => {
    const r = createProject({ name, tenant_id, template });
    if (!r.ok) { setError(r.message[lang]); setStep(r.field === 'name' ? 1 : 2); return; }
    onCreate(r.project);
  };
  const input = 'w-full rounded bg-slate-800 px-3 py-2 text-sm';
  return (
    <div role="dialog" aria-modal="true" aria-label={tr('start.new')} className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
      <div ref={dialogRef} className="w-full max-w-lg space-y-4 rounded-lg border border-slate-600 bg-slate-900 p-5">
        <div className="flex items-center"><h2 className="font-semibold">{tr('start.new')}</h2><span className="ms-auto text-xs text-slate-400">{tr('wizard.step', { n: step })}</span></div>
        {step === 1 && (
          <label className="block space-y-1 text-sm"><span>{tr('wizard.s1')}</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label={tr('wizard.name')} placeholder={tr('wizard.name')} className={input} dir="auto" />
          </label>
        )}
        {step === 2 && (
          <fieldset className="space-y-2 text-sm"><legend className="mb-1">{tr('wizard.s2')}</legend>
            {TENANT_PROFILES.map((p) => (
              <label key={p.tenant_id} className="flex cursor-pointer items-start gap-2 rounded border border-slate-700 p-2">
                <input type="radio" name="tenant" checked={tenantChoice === p.tenant_id} onChange={() => setTenantChoice(p.tenant_id)} className="mt-1" />
                <span><b dir="ltr">{p.tenant_id}</b> <span className="text-xs text-slate-400" dir="ltr">· {p.isolation}</span><br /><span className="text-xs text-slate-400">{p.summary[lang]}</span></span>
              </label>
            ))}
            <label className="flex cursor-pointer items-center gap-2 rounded border border-slate-700 p-2">
              <input type="radio" name="tenant" checked={tenantChoice === CUSTOM} onChange={() => setTenantChoice(CUSTOM)} />{tr('wizard.tenant.custom')}
            </label>
            {tenantChoice === CUSTOM && <input value={custom} onChange={(e) => setCustom(e.target.value)} aria-label={tr('wizard.tenant.id')} placeholder="acme_corp" dir="ltr" className={input} />}
          </fieldset>
        )}
        {step === 3 && (
          <fieldset className="space-y-2 text-sm"><legend className="mb-1">{tr('wizard.s3')}</legend>
            {START_TEMPLATES.map((t) => (
              <label key={t.id} className="flex cursor-pointer items-start gap-2 rounded border border-slate-700 p-2">
                <input type="radio" name="template" checked={template === t.id} onChange={() => setTemplate(t.id)} className="mt-1" />
                <span><b>{t.label[lang]}</b><br /><span className="text-xs text-slate-400">{t.description[lang]}</span></span>
              </label>
            ))}
          </fieldset>
        )}
        {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onCancel} className="rounded bg-slate-800 px-3 py-1 text-sm">{tr('wizard.cancel')}</button>
          <div className="ms-auto flex gap-2">
            {step > 1 && <button onClick={() => { setError(''); setStep(step - 1); }} className="rounded bg-slate-800 px-3 py-1 text-sm">{tr('wizard.back')}</button>}
            {step < 3 ? <button onClick={next} className="rounded bg-sky-600 px-3 py-1 text-sm">{tr('wizard.next')}</button> : <button onClick={create} className="rounded bg-emerald-700 px-3 py-1 text-sm">{tr('wizard.create')}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
