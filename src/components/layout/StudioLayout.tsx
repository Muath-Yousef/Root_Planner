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

const DeviceInspectorDrawer = lazy(() => import('../inspector/DeviceInspectorDrawer').then((m) => ({ default: m.DeviceInspectorDrawer })));
const EmployeeFactoryModal = lazy(() => import('../modals/EmployeeFactoryModal').then((m) => ({ default: m.EmployeeFactoryModal })));
const SocrootAdminCliModal = lazy(() => import('../modals/SocrootAdminCliModal').then((m) => ({ default: m.SocrootAdminCliModal })));
const BreakGlassModal = lazy(() => import('../modals/BreakGlassModal').then((m) => ({ default: m.BreakGlassModal })));
const CompanyTenantModal = lazy(() => import('../modals/CompanyTenantModal').then((m) => ({ default: m.CompanyTenantModal })));
const KillPlaneModal = lazy(() => import('../modals/KillPlaneModal').then((m) => ({ default: m.KillPlaneModal })));
const ExportBundleModal = lazy(() => import('../modals/ExportBundleModal').then((m) => ({ default: m.ExportBundleModal })));
const CommandPaletteModal = lazy(() => import('../modals/CommandPaletteModal').then((m) => ({ default: m.CommandPaletteModal })));
const ComponentInfoModal = lazy(() => import('../modals/ComponentInfoModal').then((m) => ({ default: m.ComponentInfoModal })));
const CableDetailModal = lazy(() => import('../modals/CableDetailModal').then((m) => ({ default: m.CableDetailModal })));
const ConfigEditorModal = lazy(() => import('../modals/ConfigEditorModal').then((m) => ({ default: m.ConfigEditorModal })));
const GuidedTour = lazy(() => import('../guidance/GuidedTour').then((m) => ({ default: m.GuidedTour })));
const HelpSheet = lazy(() => import('../guidance/HelpSheet').then((m) => ({ default: m.HelpSheet })));

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
