import { useState, useRef } from 'react';
import { useStudio } from '../../store/useStudioStore';
import { TENANT_PROFILES } from '../../presets/tenantProfiles';
import type { IsolationMode } from '../../types';
import { useT } from '../../i18n/useT';
import { useModalA11y } from '../layout/useModalA11y';

export function CompanyTenantModal() {
  const tr = useT();
  const tenantModalOpen = useStudio((s) => s.tenantModalOpen);
  const setTenantModalOpen = useStudio((s) => s.setTenantModalOpen);
  const tenant = useStudio((s) => s.tenant);
  const setTenant = useStudio((s) => s.setTenant);
  const budgets = useStudio((s) => s.budgets);
  const setDepartmentBudget = useStudio((s) => s.setDepartmentBudget);
  const lang = useStudio((s) => s.lang);
  const dialogRef = useRef<HTMLDivElement>(null);

  useModalA11y({
    isOpen: tenantModalOpen,
    onClose: () => setTenantModalOpen(false),
    dialogRef,
  });

  const [selectedId, setSelectedId] = useState(tenant.tenant_id);
  const [customId, setCustomId] = useState(tenant.tenant_id);
  const [isolation, setIsolation] = useState<IsolationMode>(tenant.isolation);
  const [dailyCap, setDailyCap] = useState(
    budgets.dept_opportunity_acquisition?.daily_cap_usd ?? '10.00'
  );

  if (!tenantModalOpen) return null;

  const handleSave = () => {
    const p = TENANT_PROFILES.find((t) => t.tenant_id === selectedId);
    if (selectedId === 'custom') {
      setTenant({
        tenant_id: customId.trim() || 'custom_tenant',
        name: customId.trim() || 'Custom Tenant',
        isolation,
      });
    } else if (p) {
      setTenant({
        tenant_id: p.tenant_id,
        name: p.name,
        isolation: p.isolation,
      });
    }
    setDepartmentBudget('dept_opportunity_acquisition', dailyCap);
    setTenantModalOpen(false);
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tenant-modal-title"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-5 py-4">
          <div>
            <div className="text-xs font-mono font-semibold text-sky-400 uppercase tracking-wider">
              {tr('tenant.title')}
            </div>
            <h2 id="tenant-modal-title" className="text-sm font-bold text-slate-100">
              Multi-Tenancy & Resource Governance (§5.7, TEN-001..004)
            </h2>
          </div>
          <button
            onClick={() => setTenantModalOpen(false)}
            aria-label={tr('inspector.close')}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          <div className="space-y-2">
            <label className="text-slate-400 font-medium">{tr('tenant.profile')}</label>
            <div className="space-y-2">
              {TENANT_PROFILES.map((p) => (
                <label
                  key={p.tenant_id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    selectedId === p.tenant_id
                      ? 'border-sky-500 bg-sky-950/30'
                      : 'border-slate-800 bg-slate-950/40 hover:bg-slate-800/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="tenant"
                    value={p.tenant_id}
                    checked={selectedId === p.tenant_id}
                    onChange={() => {
                      setSelectedId(p.tenant_id);
                      setIsolation(p.isolation);
                    }}
                    className="mt-0.5 text-sky-600"
                  />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100">{p.name}</span>
                      <span className="font-mono text-[10px] text-slate-400">({p.tenant_id})</span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.2 font-mono text-[10px] text-sky-400">
                        {p.isolation}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">{p.summary[lang]}</p>
                  </div>
                </label>
              ))}

              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  selectedId === 'custom'
                    ? 'border-sky-500 bg-sky-950/30'
                    : 'border-slate-800 bg-slate-950/40 hover:bg-slate-800/40'
                }`}
              >
                <input
                  type="radio"
                  name="tenant"
                  value="custom"
                  checked={selectedId === 'custom'}
                  onChange={() => setSelectedId('custom')}
                  className="mt-0.5 text-sky-600"
                />
                <div className="flex-1 space-y-2">
                  <div className="font-semibold text-slate-100">{tr('wizard.tenant.custom')}</div>
                  {selectedId === 'custom' && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="text-[10px] text-slate-400">{tr('wizard.tenant.id')}</label>
                        <input
                          value={customId}
                          onChange={(e) => setCustomId(e.target.value)}
                          className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-xs text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400">Isolation Mode</label>
                        <select
                          value={isolation}
                          onChange={(e) => setIsolation(e.target.value as IsolationMode)}
                          className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100"
                        >
                          <option value="logical_rls">logical_rls</option>
                          <option value="dedicated">dedicated (TEN-004)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </label>
            </div>
          </div>

          {/* Department Budget Caps */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 space-y-2">
            <h3 className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
              Budget Governance (§6.1, §6.7)
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-400 font-medium">{tr('tenant.daily.cap')}</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.5"
                  value={dailyCap}
                  onChange={(e) => setDailyCap(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-xs text-slate-100"
                />
              </div>
              <div>
                <label className="text-slate-400 font-medium">{tr('tenant.task.cap')}</label>
                <input
                  type="text"
                  disabled
                  value="0.30 (hard cap)"
                  className="mt-1 w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between border-t border-slate-800 bg-slate-950 px-5 py-3">
          <button
            onClick={() => setTenantModalOpen(false)}
            className="rounded bg-slate-800 px-4 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
          >
            {tr('wizard.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="rounded bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
          >
            {tr('tenant.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
