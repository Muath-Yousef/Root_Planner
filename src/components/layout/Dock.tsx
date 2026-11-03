import { useState } from 'react';
import { dockCategories, dockTemplates } from '../../registry';
import { useRegistryVersion } from '../../registry/useRegistry';
import { useStudio } from '../../store/useStudioStore';
import { useT } from '../../i18n/useT';
import { en, type MessageKey } from '../../i18n/en';

/** Two tiers: categories, then draggable templates. Both come from the registry; nothing here names a role. */
export function Dock() {
  useRegistryVersion();
  const horizon = useStudio((s) => s.horizon);
  const lang = useStudio((s) => s.lang);
  const openInfoModal = useStudio((s) => s.openInfoModal);
  const deployRole = useStudio((s) => s.deployRole);
  const tr = useT();

  const [cat, setCat] = useState('Command');
  const [q, setQ] = useState('');
  const cats = dockCategories(horizon);
  const active = cats.includes(cat) ? cat : cats[0];
  const list = dockTemplates(horizon, q, lang).filter((t) => q || t.category === active);
  const catLabel = (c: string) => {
    const k = `dock.cat.${c}`;
    return k in en ? tr(k as MessageKey) : c;
  };

  return (
    <div className="border-t border-slate-700 bg-slate-900 p-2">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
              c === active && !q ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {catLabel(c)}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tr('dock.search')}
          aria-label={tr('dock.search')}
          className="ms-auto rounded bg-slate-800 px-3 py-1 text-sm text-slate-200 border border-slate-700 focus:border-sky-500 focus:outline-hidden"
        />
      </div>
      <div role="list" aria-label={tr('dock.search')} className="flex gap-2 overflow-x-auto pb-1">
        {list.map((t) => (
          <div
            key={t.id}
            role="listitem"
            tabIndex={0}
            draggable
            title={t.description[lang]}
            aria-label={`${t.label[lang]}: ${t.description[lang]}`}
            onDragStart={(e) => e.dataTransfer.setData('application/socroot', t.id)}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                deployRole(t.id);
              }
            }}
            className="group flex items-center gap-2 cursor-grab whitespace-nowrap rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm hover:border-slate-500 hover:bg-slate-750 focus:ring-2 focus:ring-sky-400 focus:outline-hidden transition-all select-none"
          >
            <span dir="auto">{t.label[lang]}</span>
            {t.implementation_status !== 'IMPLEMENTED' && (
              <span className="text-[10px] text-amber-400 font-mono" dir="ltr">
                {t.implementation_status}
              </span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openInfoModal(t.id);
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
              }}
              className="ms-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-700/80 text-[10px] text-slate-400 hover:bg-sky-600 hover:text-white transition-colors"
              title={tr('component.info')}
              aria-label={`${tr('component.info')}: ${t.label[lang]}`}
            >
              i
            </button>
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-slate-400 p-2">{tr('dock.empty')}</p>}
      </div>
    </div>
  );
}
