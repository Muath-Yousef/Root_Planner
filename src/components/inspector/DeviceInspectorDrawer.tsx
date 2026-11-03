import { useStudio } from '../../store/useStudioStore';
import { getRole } from '../../registry';
import { useT } from '../../i18n/useT';
import { useProblems } from '../../store/useProblems';
import type { InspectorTab } from '../../registry/definitions';
import { IdentityTab } from './tabs/IdentityTab';
import { ContractTab } from './tabs/ContractTab';
import { ManifestTab } from './tabs/ManifestTab';
import { CodeTab } from './tabs/CodeTab';
import { ToolsTab } from './tabs/ToolsTab';
import { PoliciesTab } from './tabs/PoliciesTab';
import { ContextTab } from './tabs/ContextTab';

export function DeviceInspectorDrawer() {
  const tr = useT();
  const inspector = useStudio((s) => s.inspector);
  const nodes = useStudio((s) => s.nodes);
  const closeInspector = useStudio((s) => s.closeInspector);
  const openInspector = useStudio((s) => s.openInspector);
  const openInfoModal = useStudio((s) => s.openInfoModal);
  const problems = useProblems();

  if (!inspector) return null;

  const node = nodes.find((n) => n.id === inspector.nodeId);
  if (!node) return null;

  const def = getRole(node.data.role);
  const allowedTabs: InspectorTab[] = def?.inspector ?? (
    node.data.kind === 'employee'
      ? ['identity', 'contract', 'manifest', 'code', 'tools', 'policies', 'context']
      : ['identity']
  );
  const currentTab = (allowedTabs.includes(inspector.tab as InspectorTab) ? inspector.tab : allowedTabs[0]) as InspectorTab;

  const label = node.data.employee
    ? String((node.data.employee.contract as { employee_id?: string }).employee_id ?? node.data.label)
    : node.data.label;

  // Problem counts per inspector tab for this specific node
  const nodeProblems = problems.filter((p) => p.nodeId === node.id);
  const tabProblemCounts = allowedTabs.reduce<Record<string, number>>((acc, tab) => {
    acc[tab] = nodeProblems.filter((p) => p.tab === tab).length;
    return acc;
  }, {});

  return (
    <aside
      aria-label={tr('inspector.title')}
      className="fixed inset-y-0 end-0 z-40 flex w-[490px] max-w-[95vw] flex-col border-s border-slate-700 bg-slate-900 shadow-2xl transition-all"
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-sky-400">{node.data.role}</span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400 font-mono">
              {node.data.kind}
            </span>
            <button
              onClick={() => openInfoModal(node.data.role)}
              className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-800 text-[10px] text-slate-400 hover:bg-sky-600 hover:text-white transition-colors"
              title={tr('component.info')}
              aria-label={tr('component.info')}
            >
              i
            </button>
          </div>
          <h2 className="truncate font-semibold text-sm text-slate-100" dir="auto">{label}</h2>
        </div>
        <button
          onClick={closeInspector}
          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          aria-label={tr('inspector.close')}
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Tabs Bar with Problem Badges */}
      <div className="flex border-b border-slate-800 bg-slate-950/80 px-2 overflow-x-auto">
        {allowedTabs.map((tab) => {
          const isActive = currentTab === tab;
          const tabLabelKey = `inspector.tab.${tab}` as const;
          const count = tabProblemCounts[tab] ?? 0;
          return (
            <button
              key={tab}
              onClick={() => openInspector(node.id, tab, undefined, inspector.advanced)}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                isActive
                  ? 'border-sky-500 text-sky-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{tr(tabLabelKey)}</span>
              {count > 0 && (
                <span className="rounded-full bg-rose-600 px-1.5 py-0.2 text-[10px] font-bold text-white font-mono shadow-xs">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {currentTab === 'identity' && <IdentityTab node={node} />}
        {currentTab === 'contract' && (
          <ContractTab
            node={node}
            initialField={inspector.field}
            initialAdvanced={inspector.advanced}
          />
        )}
        {currentTab === 'manifest' && (
          <ManifestTab
            node={node}
            initialField={inspector.field}
            initialAdvanced={inspector.advanced}
          />
        )}
        {currentTab === 'code' && <CodeTab node={node} />}
        {currentTab === 'tools' && <ToolsTab node={node} />}
        {currentTab === 'policies' && <PoliciesTab node={node} />}
        {currentTab === 'context' && <ContextTab node={node} />}
      </div>
    </aside>
  );
}
