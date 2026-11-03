import { lazy, Suspense, useEffect, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { useStudio } from '../../store/useStudioStore';
import { TopologyCanvas } from '../canvas/TopologyCanvas';
import { ProblemsPanel } from '../problems/ProblemsPanel';
import { PduSimulationPanel } from '../simulation/PduSimulationPanel';
import { Dock } from './Dock';
import { StatusBar } from './StatusBar';
import { TopControlBar } from './TopControlBar';
import { Toasts } from './Toasts';
import { useAutosave } from './useAutosave';
import { useShortcuts } from './useShortcuts';
import { ErrorBoundary } from './ErrorBoundary';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useT } from '../../i18n/useT';
import { get } from 'idb-keyval';

function createLazy<P extends object>(
  loader: () => Promise<Record<string, React.ComponentType<P>>>,
  exportName: string
): React.ComponentType<P> {
  let loadedComponent: React.ComponentType<P> | null = null;
  const promise = loader().then((m) => {
    loadedComponent = m[exportName];
    return { default: m[exportName] };
  });
  const LazyComp = lazy(() => promise);

  return function LazyWrapper(props: P) {
    if (loadedComponent) {
      const Comp = loadedComponent;
      return <Comp {...props} />;
    }
    return <LazyComp {...props} />;
  };
}

const DeviceInspectorDrawer = createLazy(() => import('../inspector/DeviceInspectorDrawer'), 'DeviceInspectorDrawer');
const EmployeeFactoryModal = createLazy(() => import('../modals/EmployeeFactoryModal'), 'EmployeeFactoryModal');
const SocrootAdminCliModal = createLazy(() => import('../modals/SocrootAdminCliModal'), 'SocrootAdminCliModal');
const BreakGlassModal = createLazy(() => import('../modals/BreakGlassModal'), 'BreakGlassModal');
const CompanyTenantModal = createLazy(() => import('../modals/CompanyTenantModal'), 'CompanyTenantModal');
const KillPlaneModal = createLazy(() => import('../modals/KillPlaneModal'), 'KillPlaneModal');
const ExportBundleModal = createLazy(() => import('../modals/ExportBundleModal'), 'ExportBundleModal');
const CommandPaletteModal = createLazy(() => import('../modals/CommandPaletteModal'), 'CommandPaletteModal');
const ComponentInfoModal = createLazy(() => import('../modals/ComponentInfoModal'), 'ComponentInfoModal');
const CableDetailModal = createLazy(() => import('../modals/CableDetailModal'), 'CableDetailModal');
const ConfigEditorModal = createLazy(() => import('../modals/ConfigEditorModal'), 'ConfigEditorModal');
const GuidedTour = createLazy(() => import('../guidance/GuidedTour'), 'GuidedTour');
const HelpSheet = createLazy(() => import('../guidance/HelpSheet'), 'HelpSheet');

/** The working screen: top bar, canvas, side panel (dockable tabs for Problems and Simulation), dock, status bar. */
export function StudioLayout({ onHome }: { onHome: () => void }) {
  const mode = useStudio((s) => s.mode);
  const activeDockTab = useStudio((s) => s.activeDockTab);
  const setActiveDockTab = useStudio((s) => s.setActiveDockTab);
  const confirmModal = useStudio((s) => s.confirmModal);
  const closeConfirm = useStudio((s) => s.closeConfirm);
  const tourOpen = useStudio((s) => s.tourOpen);
  const setTourOpen = useStudio((s) => s.setTourOpen);
  const helpSheetOpen = useStudio((s) => s.helpSheetOpen);
  const inspector = useStudio((s) => s.inspector);
  const factoryModal = useStudio((s) => s.factoryModal);
  const cliModalOpen = useStudio((s) => s.cliModalOpen);
  const breakGlassModalOpen = useStudio((s) => s.breakGlassModalOpen);
  const tenantModalOpen = useStudio((s) => s.tenantModalOpen);
  const killModalOpen = useStudio((s) => s.killModalOpen);
  const exportModalOpen = useStudio((s) => s.exportModalOpen);
  const commandPaletteOpen = useStudio((s) => s.commandPaletteOpen);
  const infoModalRoleId = useStudio((s) => s.infoModalRoleId);
  const selectedCableEdgeId = useStudio((s) => s.selectedCableEdgeId);
  const configEditorModalOpen = useStudio((s) => s.configEditorModalOpen);
  const saved = useAutosave();
  const tr = useT();

  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    try {
      const savedWidth = localStorage.getItem('socroot:panel_width');
      return savedWidth ? Math.max(280, Math.min(600, parseInt(savedWidth, 10))) : 380;
    } catch {
      return 380;
    }
  });
  const [isResizing, setIsResizing] = useState(false);

  useShortcuts();

  // Auto-collapse side panel on small screens (< 1100 px) & check first-run tour
  useEffect(() => {
    const checkWidth = () => {
      if (window.innerWidth < 1100) {
        setPanelCollapsed(true);
      }
    };
    checkWidth();
    window.addEventListener('resize', checkWidth);

    // Check first run tour via IndexedDB
    if (import.meta.env.MODE !== 'test') {
      void get<boolean>('socroot:tour_seen').then((seen) => {
        if (!seen) {
          setTourOpen(true);
        }
      });
    }

    return () => window.removeEventListener('resize', checkWidth);
  }, [setTourOpen]);

  // Mouse move handler for resizing side panel
  useEffect(() => {
    if (!isResizing) return;

    const onMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(280, Math.min(600, window.innerWidth - e.clientX));
      setPanelWidth(newWidth);
      try {
        localStorage.setItem('socroot:panel_width', String(newWidth));
      } catch {}
    };

    const onMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isResizing]);

  return (
    <ReactFlowProvider>
      <div className="flex h-full flex-col">
        <TopControlBar onHome={onHome} />
        <div className="flex min-h-0 flex-1 relative overflow-hidden">
          <TopologyCanvas />

          {/* Resizable & Collapsible Side Panel with Dockable Tabs */}
          <div className="relative flex">
            {/* Collapse toggle tab button */}
            <button
              onClick={() => setPanelCollapsed(!panelCollapsed)}
              className="absolute -start-6 top-4 z-20 flex h-10 w-6 items-center justify-center rounded-s border border-e-0 border-slate-700 bg-slate-900 text-xs text-slate-400 hover:text-white transition-colors"
              title={panelCollapsed ? tr('panel.expand') : tr('panel.collapse')}
              aria-label={panelCollapsed ? tr('panel.expand') : tr('panel.collapse')}
            >
              {panelCollapsed ? '◀' : '▶'}
            </button>

            {!panelCollapsed && (
              <div className="flex relative">
                {/* Drag handle for resizing */}
                <div
                  onMouseDown={() => setIsResizing(true)}
                  className="w-1.5 cursor-col-resize hover:bg-sky-500/50 active:bg-sky-500 z-10 transition-colors"
                  title="Drag to resize panel"
                />

                <aside
                  style={{ width: `${panelWidth}px` }}
                  className="shrink-0 space-y-3 overflow-y-auto border-s border-slate-700 bg-slate-900 p-3 text-sm transition-all flex flex-col"
                >
                  {/* Dockable Header Tabs: Problems | Simulation */}
                  <div className="flex border-b border-slate-800 bg-slate-950 p-1 rounded-lg gap-1">
                    <button
                      onClick={() => setActiveDockTab('problems')}
                      className={`flex-1 rounded py-1 text-xs font-medium transition-colors ${
                        activeDockTab === 'problems'
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tr('panel.tab.problems')}
                    </button>
                    <button
                      onClick={() => setActiveDockTab('simulation')}
                      className={`flex-1 rounded py-1 text-xs font-medium transition-colors ${
                        activeDockTab === 'simulation'
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tr('panel.tab.simulation')}
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    <ErrorBoundary>
                      {activeDockTab === 'simulation' ? <PduSimulationPanel /> : <ProblemsPanel />}
                    </ErrorBoundary>
                  </div>
                </aside>
              </div>
            )}
          </div>
        </div>

        {mode === 'design' && <Dock />}
        <StatusBar saved={saved} />

        {/* Global Feedback Toasts */}
        <Toasts />

        {/* Global Confirmation Modal */}
        {confirmModal && (
          <ConfirmDialog
            isOpen={!!confirmModal}
            title={confirmModal.title}
            description={confirmModal.description}
            confirmLabel={confirmModal.confirmLabel}
            cancelLabel={confirmModal.cancelLabel}
            isDestructive={confirmModal.isDestructive}
            onConfirm={confirmModal.onConfirm}
            onCancel={() => {
              if (confirmModal.onCancel) confirmModal.onCancel();
              closeConfirm();
            }}
          />
        )}

        {/* Guidance & Modals (Lazy Loaded) */}
        <Suspense fallback={null}>
          {tourOpen && <GuidedTour />}
          {helpSheetOpen && <HelpSheet />}
          {inspector && <DeviceInspectorDrawer />}
          {factoryModal && <EmployeeFactoryModal />}
          {cliModalOpen && <SocrootAdminCliModal />}
          {breakGlassModalOpen && <BreakGlassModal />}
          {tenantModalOpen && <CompanyTenantModal />}
          {killModalOpen && <KillPlaneModal />}
          {exportModalOpen && <ExportBundleModal />}
          {commandPaletteOpen && <CommandPaletteModal />}
          {infoModalRoleId && <ComponentInfoModal />}
          {selectedCableEdgeId && <CableDetailModal />}
          {configEditorModalOpen && <ConfigEditorModal />}
        </Suspense>
      </div>
    </ReactFlowProvider>
  );
}
