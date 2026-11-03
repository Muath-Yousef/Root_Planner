import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { setAutoFreeze } from 'immer';
import { applyEdgeChanges, applyNodeChanges, type Connection, type EdgeChange, type NodeChange, type XYPosition } from '@xyflow/react';
import { referenceEdges, referenceNodes } from '../presets/referenceTopology';
import { defaultConfigs } from '../presets/defaultConfigs';
import { tenantProfile } from '../presets/tenantProfiles';
import { checkConnection, compatibleNodes } from '../engine/cablingValidator';
import { templateNodeData, reconcileNode } from '../engine/employeeFactory';
import { collectProblems, errorCount, type Problem } from '../engine/problems';
import { getRole, mkEdge, parsePort } from '../registry';
import { CURRENT_FORMAT_VERSION } from '../schemas/project';
import { stripEdges, stripTransient } from '../persistence/projectIO';
import { emptyHistory, pushSnapshot, redo as redoH, undo as undoH, type History } from './history';
import { copyNodes, pasteClip, removeNodes, selectedIds, type Clip } from './graphOps';
import { alignNodes, distributeNodes, autoLayout, type AlignMode } from '../engine/layout';
import { placeEmployee } from '../engine/factoryPlacement';
import { KillSwitchManager } from '../engine/killSwitchManager';
import { AuditLogger } from '../engine/auditLogger';
import { microToUsd } from '../engine/pricingCalculator';
import type { Edit } from '../engine/inspectorEdit';
import type { CliEffect } from '../engine/adminCli';
import type { CableKind, Horizon, Lang, Mode, ProjectConfigs, ProjectFile, SEdge, SNode, TenantRef, Theme } from '../types';
import { t } from '../i18n';

// React Flow mutates/replaces node objects itself; frozen drafts would make it throw.
setAutoFreeze(false);

interface Rejection { code: string; reason: string; fix?: string }
export interface ProjectMeta { id: string; name: string; created_at: string }
export interface InspectorState { nodeId: string; tab: string; field?: string; advanced?: boolean }
type Hist = History<SNode, SEdge>;

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  kind: 'info' | 'success' | 'warning' | 'error';
  message: string;
  action?: ToastAction;
  duration?: number;
  createdAt: number;
}

export interface ConfirmState {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

interface S {
  nodes: SNode[]; edges: SEdge[]; tenant: TenantRef; tenant_id: string; horizon: Horizon; lang: Lang; theme: Theme; mode: Mode;
  configs: ProjectConfigs; project: ProjectMeta;
  rejection: Rejection | null; compat: Set<string> | null; selected: string | null;
  history: Hist; clipboard: Clip | null; dragActive: boolean;
  /** Bumped on every content change (not selection/measurement); the autosaver watches it. */
  revision: number;

  // Feedback & Notifications
  toasts: ToastItem[];
  notify: (kind: 'info' | 'success' | 'warning' | 'error', message: string, opts?: { action?: ToastAction; duration?: number }) => string;
  dismissToast: (id: string) => void;

  // View ergonomics & preferences
  snapToGrid: boolean;
  setSnapToGrid: (snap: boolean) => void;
  reducedMotion: boolean;
  setReducedMotion: (rm: boolean) => void;
  dimUnrelated: boolean;
  setDimUnrelated: (dim: boolean) => void;

  // Guidance & Modals
  helpSheetOpen: boolean;
  setHelpSheetOpen: (open: boolean) => void;
  tourOpen: boolean;
  setTourOpen: (open: boolean) => void;
  confirmModal: ConfirmState | null;
  showConfirm: (opts: ConfirmState) => void;
  closeConfirm: () => void;

  // Inspector
  inspector: InspectorState | null;
  openInspector: (nodeId: string, tab?: string, field?: string, advanced?: boolean) => void;
  closeInspector: () => void;
  applyEdit: (nodeId: string, fn: (node: SNode, tenant_id: string) => Edit) => Edit;

  // Modals & Tools
  factoryModal: { roleId: string; position: XYPosition } | null;
  openFactoryModal: (roleId: string, position: XYPosition) => void;
  closeFactoryModal: () => void;
  addEmployeeFromFactory: (node: SNode, edges: SEdge[]) => void;

  infoModalRoleId: string | null;
  openInfoModal: (roleId: string) => void;
  closeInfoModal: () => void;

  selectedCableEdgeId: string | null;
  openCableModal: (edgeId: string) => void;
  closeCableModal: () => void;

  configEditorModalOpen: boolean;
  setConfigEditorModalOpen: (open: boolean) => void;
  saveConfig: (filename: string, content: string) => void;

  activeActorNodeId: string | null;
  setActiveActorNodeId: (id: string | null) => void;
  activePulsingCableId: string | null;
  setActivePulsingCableId: (id: string | null) => void;

  activeDockTab: 'problems' | 'simulation' | 'audit';
  setActiveDockTab: (tab: 'problems' | 'simulation' | 'audit') => void;

  cliModalOpen: boolean;
  setCliModalOpen: (open: boolean) => void;
  breakGlassModalOpen: boolean;
  setBreakGlassModalOpen: (open: boolean) => void;
  tenantModalOpen: boolean;
  setTenantModalOpen: (open: boolean) => void;
  exportModalOpen: boolean;
  setExportModalOpen: (open: boolean) => void;
  killModalOpen: boolean;
  setKillModalOpen: (open: boolean) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  killSwitch: KillSwitchManager;
  auditLogger: AuditLogger;
  budgets: Record<string, { daily_cap_usd: string; spent_usd: string }>;
  setDepartmentBudget: (dept: string, daily_cap_usd: string) => void;
  applyCliEffect: (effect: CliEffect) => void;

  // Layout & Sizing
  alignSelected: (mode: AlignMode) => void;
  distributeSelected: (axis: 'x' | 'y') => void;
  autoLayoutCanvas: () => void;
  updateNodeDimensions: (nodeId: string, width: number, height: number) => void;

  // Canvas
  onNodesChange: (c: NodeChange<SNode>[]) => void; onEdgesChange: (c: EdgeChange<SEdge>[]) => void;
  startDrag: (nodeId: string, handleId: string | null) => void; endDrag: () => void;
  connect: (c: Connection) => void; addRole: (role: string, p: XYPosition) => void;
  deployRole: (role: string, p?: XYPosition) => void;
  setHorizon: (h: Horizon) => void; setLang: (l: Lang) => void; setTheme: (t: Theme) => void; setMode: (m: Mode) => void;
  dismiss: () => void; select: (id: string | null) => void;
  undo: () => void; redo: () => void; canUndo: () => boolean; canRedo: () => boolean;
  copy: () => void; paste: () => void; duplicate: () => void; deleteSelection: () => void; requestDeleteSelection: () => void; selectAll: () => void;
  setTenant: (t: TenantRef) => void; rename: (name: string) => void;
  loadProject: (p: ProjectFile) => void; toProject: () => ProjectFile;
}

const getInitialPrefs = () => {
  if (typeof window === 'undefined') {
    return { lang: 'en' as Lang, theme: 'dark' as Theme, snapToGrid: true, reducedMotion: false, dimUnrelated: true };
  }
  try {
    const raw = localStorage.getItem('socroot:ui_prefs');
    const systemReducedMotion = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
    if (raw) {
      const p = JSON.parse(raw);
      return {
        lang: (p.lang === 'ar' ? 'ar' : 'en') as Lang,
        theme: (p.theme === 'light' ? 'light' : 'dark') as Theme,
        snapToGrid: p.snapToGrid !== false,
        reducedMotion: p.reducedMotion !== undefined ? !!p.reducedMotion : systemReducedMotion,
        dimUnrelated: p.dimUnrelated !== false,
      };
    }
    return { lang: 'en' as Lang, theme: 'dark' as Theme, snapToGrid: true, reducedMotion: systemReducedMotion, dimUnrelated: true };
  } catch {}
  return { lang: 'en' as Lang, theme: 'dark' as Theme, snapToGrid: true, reducedMotion: false, dimUnrelated: true };
};
const initPrefs = getInitialPrefs();
if (typeof document !== 'undefined') {
  document.documentElement.lang = initPrefs.lang;
  document.documentElement.dir = initPrefs.lang === 'ar' ? 'rtl' : 'ltr';
  if (initPrefs.theme === 'light') document.documentElement.className = 'light';
}

const newProjectMeta = (): ProjectMeta => ({ id: `proj-${Date.now().toString(36)}`, name: 'Reference company', created_at: new Date().toISOString() });
const coreTenant = (): TenantRef => { const p = tenantProfile('socroot-core'); return { tenant_id: 'socroot-core', isolation: p?.isolation ?? 'logical_rls', name: p?.name ?? 'socroot-core' }; };
const uid = (old: string) => `${old.replace(/-[a-z0-9]+$/, '')}-${Math.random().toString(36).slice(2, 7)}`;

export const studioKillSwitch = new KillSwitchManager();
export const studioAuditLogger = new AuditLogger();

export const useStudio = create<S>()(immer((set, get) => {
  /** Record the current graph so the next change can be undone. */
  // Always read plain (non-draft) arrays via get(): iterating 300 immer drafts on every drag tick would be wasteful.
  const checkpoint = (draft: { history: Hist }) => { const cur = get(); draft.history = pushSnapshot(draft.history, { nodes: cur.nodes, edges: cur.edges }); };
  return {
    nodes: referenceNodes, edges: referenceEdges, tenant: coreTenant(), tenant_id: 'socroot-core', horizon: 'CURRENT', lang: initPrefs.lang, theme: initPrefs.theme, mode: 'design',
    configs: defaultConfigs(), project: newProjectMeta(),
    rejection: null, compat: null, selected: null, history: emptyHistory(), clipboard: null, dragActive: false, revision: 0,

    toasts: [],
    notify: (kind, message, opts) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const item: ToastItem = {
        id,
        kind,
        message,
        action: opts?.action,
        duration: opts?.duration ?? 4500,
        createdAt: Date.now(),
      };
      set((s) => {
        s.toasts = [...s.toasts.slice(-4), item];
      });
      return id;
    },
    dismissToast: (id) => set((s) => {
      s.toasts = s.toasts.filter((t) => t.id !== id);
    }),

    snapToGrid: initPrefs.snapToGrid,
    setSnapToGrid: (snapToGrid) => set((s) => {
      s.snapToGrid = snapToGrid;
      try {
        const raw = localStorage.getItem('socroot:ui_prefs');
        const p = raw ? JSON.parse(raw) : {};
        p.snapToGrid = snapToGrid;
        localStorage.setItem('socroot:ui_prefs', JSON.stringify(p));
      } catch {}
    }),

    reducedMotion: initPrefs.reducedMotion,
    setReducedMotion: (reducedMotion) => set((s) => {
      s.reducedMotion = reducedMotion;
      try {
        const raw = localStorage.getItem('socroot:ui_prefs');
        const p = raw ? JSON.parse(raw) : {};
        p.reducedMotion = reducedMotion;
        localStorage.setItem('socroot:ui_prefs', JSON.stringify(p));
      } catch {}
    }),

    dimUnrelated: initPrefs.dimUnrelated,
    setDimUnrelated: (dimUnrelated) => set((s) => {
      s.dimUnrelated = dimUnrelated;
      try {
        const raw = localStorage.getItem('socroot:ui_prefs');
        const p = raw ? JSON.parse(raw) : {};
        p.dimUnrelated = dimUnrelated;
        localStorage.setItem('socroot:ui_prefs', JSON.stringify(p));
      } catch {}
    }),

    helpSheetOpen: false,
    setHelpSheetOpen: (open) => set((s) => { s.helpSheetOpen = open; }),
    tourOpen: false,
    setTourOpen: (open) => set((s) => { s.tourOpen = open; }),
    confirmModal: null,
    showConfirm: (opts) => set((s) => { s.confirmModal = opts; }),
    closeConfirm: () => set((s) => { s.confirmModal = null; }),

    inspector: null,
    infoModalRoleId: null,
    selectedCableEdgeId: null,
    configEditorModalOpen: false,
    activeActorNodeId: null,
    activePulsingCableId: null,
    activeDockTab: 'problems',
    factoryModal: null,
    cliModalOpen: false,
    breakGlassModalOpen: false,
    tenantModalOpen: false,
    exportModalOpen: false,
    killModalOpen: false,
    commandPaletteOpen: false,
    killSwitch: studioKillSwitch,
    auditLogger: studioAuditLogger,
    budgets: {
      dept_opportunity_acquisition: { daily_cap_usd: '10.00', spent_usd: '0.00' },
    },

    openInspector: (nodeId, tab, field, advanced) => set((s) => {
      const cur = get().nodes.find((n) => n.id === nodeId);
      const defTab = tab ?? (cur?.data.kind === 'employee' ? 'identity' : 'identity');
      s.inspector = { nodeId, tab: defTab, field, advanced: advanced ?? false };
      s.selected = nodeId;
    }),
    closeInspector: () => set((s) => {
      s.inspector = null;
    }),
    applyEdit: (nodeId, fn) => {
      const { nodes, tenant_id } = get();
      const cur = nodes.find((n) => n.id === nodeId);
      if (!cur) return { ok: false, code: 'NODE_NOT_FOUND', message: `Node ${nodeId} not found.` };
      const res = fn(cur, tenant_id);
      if (res.ok) {
        set((s) => {
          checkpoint(s);
          s.nodes = s.nodes.map((n) => (n.id === nodeId ? res.node : n));
          s.revision++;
        });
      }
      return res;
    },

    openFactoryModal: (roleId, position) => set((s) => { s.factoryModal = { roleId, position }; }),
    closeFactoryModal: () => set((s) => { s.factoryModal = null; }),
    addEmployeeFromFactory: (node, edges) => set((s) => {
      checkpoint(s);
      s.nodes = [...s.nodes, node];
      s.edges = [...s.edges, ...edges];
      s.revision++;
      s.factoryModal = null;
      s.selected = node.id;
      s.inspector = { nodeId: node.id, tab: 'identity' };
    }),

    openInfoModal: (roleId) => set((s) => { s.infoModalRoleId = roleId; }),
    closeInfoModal: () => set((s) => { s.infoModalRoleId = null; }),
    openCableModal: (edgeId) => set((s) => { s.selectedCableEdgeId = edgeId; }),
    closeCableModal: () => set((s) => { s.selectedCableEdgeId = null; }),
    setConfigEditorModalOpen: (open) => set((s) => { s.configEditorModalOpen = open; }),
    saveConfig: (filename, content) => set((s) => {
      (s.configs as Record<string, string>)[filename] = content;
      s.revision++;
    }),
    setActiveActorNodeId: (id) => set((s) => { s.activeActorNodeId = id; }),
    setActivePulsingCableId: (id) => set((s) => { s.activePulsingCableId = id; }),
    setActiveDockTab: (tab) => set((s) => { s.activeDockTab = tab; }),

    setCliModalOpen: (open) => set((s) => { s.cliModalOpen = open; }),
    setBreakGlassModalOpen: (open) => set((s) => { s.breakGlassModalOpen = open; }),
    setTenantModalOpen: (open) => set((s) => { s.tenantModalOpen = open; }),
    setExportModalOpen: (open) => set((s) => { s.exportModalOpen = open; }),
    setKillModalOpen: (open) => set((s) => { s.killModalOpen = open; }),
    setCommandPaletteOpen: (open) => set((s) => { s.commandPaletteOpen = open; }),

    setDepartmentBudget: (dept, daily_cap_usd) => set((s) => {
      s.budgets[dept] = { daily_cap_usd, spent_usd: s.budgets[dept]?.spent_usd ?? '0.00' };
      s.revision++;
    }),

    applyCliEffect: (effect) => set((s) => {
      if (effect.type === 'add_employee') {
        const curNodes = get().nodes;
        const zone = curNodes.find((z) => z.data.kind === 'zone' && (z.data.zone?.department_id === effect.department || z.data.label === effect.department));
        const pos = zone ? { x: zone.position.x + 30, y: zone.position.y + 60 } : { x: 300, y: 300 };
        const p = placeEmployee({ roleId: effect.template, position: pos, tenant_id: s.tenant_id, nodes: curNodes });
        if (p.ok) {
          checkpoint(s);
          s.nodes = [...s.nodes, p.node];
          s.edges = [...s.edges, ...p.edges];
          s.revision++;
        }
      } else if (effect.type === 'set_deployment') {
        const curNodes = get().nodes;
        const target = curNodes.find((n) => n.data.employee?.contract && (n.data.employee.contract as Record<string, unknown>).employee_id === effect.employee_id);
        if (target && target.data.employee) {
          checkpoint(s);
          const nextEmp = { ...target.data.employee, deployment: 'RUNNING' as const };
          if (nextEmp.manifest?.metadata) {
            (nextEmp.manifest.metadata as Record<string, unknown>).lifecycle_state = 'RUNNING';
          }
          const reconciled = reconcileNode({ ...target, data: { ...target.data, employee: nextEmp } }, s.tenant_id);
          s.nodes = s.nodes.map((n) => (n.id === target.id ? reconciled : n));
          s.revision++;
        }
      } else if (effect.type === 'set_budget_cap') {
        checkpoint(s);
        const usd = microToUsd(effect.daily_cap_micro);
        s.budgets[effect.department] = { daily_cap_usd: usd, spent_usd: s.budgets[effect.department]?.spent_usd ?? '0.00' };
        s.revision++;
      } else if (effect.type === 'refresh') {
        s.revision++;
      }
    }),

    alignSelected: (mode) => set((s) => {
      const ids = selectedIds(get().nodes);
      if (ids.length < 2) return;
      checkpoint(s);
      s.nodes = alignNodes(get().nodes, ids, mode);
      s.revision++;
    }),
    distributeSelected: (axis) => set((s) => {
      const ids = selectedIds(get().nodes);
      if (ids.length < 3) return;
      checkpoint(s);
      s.nodes = distributeNodes(get().nodes, ids, axis);
      s.revision++;
    }),
    autoLayoutCanvas: () => set((s) => {
      checkpoint(s);
      s.nodes = autoLayout(get().nodes, get().edges);
      s.revision++;
    }),
    updateNodeDimensions: (nodeId, width, height) => set((s) => {
      const w = Math.max(100, Math.round(width));
      const h = Math.max(60, Math.round(height));
      const target = s.nodes.find((n) => n.id === nodeId);
      if (target) {
        checkpoint(s);
        s.nodes = s.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                style: { ...n.style, width: w, height: h },
                width: w,
                height: h,
              }
            : n
        );
        s.revision++;
      }
    }),

    onNodesChange: (changes) => set((s) => {
      const startsDrag = !s.dragActive && changes.some((c) => c.type === 'position' && c.dragging === true);
      const endsDrag = changes.some((c) => c.type === 'position' && c.dragging === false);
      const endsResize = changes.some((c) => c.type === 'dimensions' && c.resizing === false);
      if (changes.some((c) => c.type === 'remove') || startsDrag || endsResize) checkpoint(s);
      if (startsDrag) s.dragActive = true; else if (endsDrag) s.dragActive = false;
      if (changes.some((c) => c.type !== 'select' && (c.type !== 'dimensions' || c.resizing !== undefined))) s.revision++;

      const updated = applyNodeChanges(changes, get().nodes);
      s.nodes = updated.map((n) => {
        const dc = changes.find((c) => c.type === 'dimensions' && c.id === n.id && c.dimensions);
        if (dc && dc.type === 'dimensions' && dc.dimensions) {
          const w = Math.round(dc.dimensions.width);
          const h = Math.round(dc.dimensions.height);
          return {
            ...n,
            style: { ...n.style, width: w, height: h },
            width: w,
            height: h,
          };
        }
        return n;
      });
    }),
    onEdgesChange: (changes) => set((s) => {
      if (changes.some((c) => c.type === 'remove')) checkpoint(s);
      if (changes.some((c) => c.type !== 'select')) s.revision++;
      s.edges = applyEdgeChanges(changes, get().edges);
    }),
    startDrag: (nodeId, handleId) => {
      const { nodes } = get();
      const src = nodes.find((n) => n.id === nodeId), port = parsePort(handleId);
      if (src && port) set((s) => { s.compat = compatibleNodes(src, port.cable, port.direction, nodes); });
    },
    endDrag: () => set((s) => { s.compat = null; }),
    connect: (c) => {
      const { nodes, edges } = get();
      const src = nodes.find((n) => n.id === c.source), dst = nodes.find((n) => n.id === c.target);
      if (!src || !dst) return;
      const { kind, verdict } = checkConnection(src, dst, c.sourceHandle, c.targetHandle);
      if (!verdict.ok) {
        get().notify('warning', `[${verdict.code}] ${verdict.reason}`);
        return set((s) => { s.rejection = { code: verdict.code, reason: verdict.reason, fix: verdict.fix }; });
      }
      if (!kind) return;
      const edge = mkEdge(src.id, dst.id, kind as CableKind);
      if (!edges.some((x) => x.id === edge.id)) set((s) => { checkpoint(s); s.edges = [...s.edges, edge]; s.rejection = null; s.revision++; });
    },
    addRole: (role, position) => set((s) => {
      const data = templateNodeData(role, { prefix: 'new', department: 'unassigned', manager_id: 'unassigned.manager.v1', tenant_id: s.tenant_id });
      const isZone = data.kind === 'zone';
      const node: SNode = {
        id: `${role}-${Date.now().toString(36)}`,
        type: isZone ? 'zone' : 'studio',
        position,
        data,
        ...(isZone ? { style: { width: 360, height: 240 }, width: 360, height: 240, zIndex: -1 } : {}),
      };
      const cur = get().nodes; checkpoint(s); s.nodes = isZone ? [node, ...cur] : [...cur, node]; s.revision++;
    }),
    deployRole: (role, position) => {
      let pos = position;
      if (!pos) {
        const count = get().nodes.length;
        const step = count % 10;
        pos = {
          x: 240 + (step * 45) % 360,
          y: 160 + (step * 35) % 280,
        };
      }
      const def = getRole(role);
      if (def && def.kind === 'employee') {
        get().openFactoryModal(role, pos);
      } else {
        get().addRole(role, pos);
      }
    },
    setHorizon: (horizon) => set((s) => { s.horizon = horizon; s.revision++; }),
    setLang: (lang) => set((s) => {
      s.lang = lang;
      try {
        const raw = localStorage.getItem('socroot:ui_prefs');
        const p = raw ? JSON.parse(raw) : {};
        p.lang = lang;
        localStorage.setItem('socroot:ui_prefs', JSON.stringify(p));
      } catch {}
      if (typeof document !== 'undefined') {
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      }
    }),
    setTheme: (theme) => set((s) => {
      s.theme = theme;
      try {
        const raw = localStorage.getItem('socroot:ui_prefs');
        const p = raw ? JSON.parse(raw) : {};
        p.theme = theme;
        localStorage.setItem('socroot:ui_prefs', JSON.stringify(p));
      } catch {}
      if (typeof document !== 'undefined') {
        document.documentElement.className = theme === 'light' ? 'light' : '';
      }
    }),
    setMode: (mode) => set((s) => {
      s.mode = mode;
      if (mode === 'simulate') {
        s.activeDockTab = 'simulation';
      }
    }),
    dismiss: () => set((s) => { s.rejection = null; }), select: (selected) => set((s) => { s.selected = selected; }),

    undo: () => set((s) => {
      const cur = get(); const r = undoH(s.history, { nodes: cur.nodes, edges: cur.edges });
      if (r) { s.history = r.history; s.nodes = r.snapshot.nodes; s.edges = r.snapshot.edges; s.revision++; }
    }),
    redo: () => set((s) => {
      const cur = get(); const r = redoH(s.history, { nodes: cur.nodes, edges: cur.edges });
      if (r) { s.history = r.history; s.nodes = r.snapshot.nodes; s.edges = r.snapshot.edges; s.revision++; }
    }),
    canUndo: () => get().history.past.length > 0, canRedo: () => get().history.future.length > 0,

    copy: () => { const { nodes, edges } = get(); const ids = selectedIds(nodes); if (ids.length) set((s) => { s.clipboard = copyNodes(nodes, edges, ids); }); },
    paste: () => {
      const { clipboard, nodes, edges, lang } = get(); if (!clipboard) return;
      const p = pasteClip(clipboard, { x: 40, y: 40 }, uid);
      const nextNodes = [...nodes.map((n) => (n.selected ? { ...n, selected: false } : n)), ...p.nodes], nextEdges = [...edges, ...p.edges];
      set((s) => { checkpoint(s); s.nodes = nextNodes; s.edges = nextEdges; s.revision++; s.clipboard = copyNodes(nextNodes, nextEdges, p.ids); }); // consecutive pastes cascade
      get().notify('info', t(lang, 'toast.pasted', { n: p.nodes.length }));
    },
    duplicate: () => { get().copy(); get().paste(); },
    deleteSelection: () => {
      const { nodes, edges, lang } = get(); const ids = selectedIds(nodes); if (!ids.length) return;
      const r = removeNodes(nodes, edges, ids);
      const deletedCount = ids.length;
      set((s) => { checkpoint(s); s.nodes = r.nodes; s.edges = r.edges; s.revision++; });
      get().notify('info', t(lang, 'toast.deleted', { n: deletedCount }), {
        action: {
          label: t(lang, 'toast.undo'),
          onClick: () => get().undo(),
        },
      });
    },
    requestDeleteSelection: () => {
      const { nodes, edges, lang } = get();
      const ids = selectedIds(nodes);
      if (!ids.length) return;
      const connectedEdges = edges.filter((e) => ids.includes(e.source) || ids.includes(e.target));
      const children = nodes.filter((n) => n.parentId && ids.includes(n.parentId));
      if (connectedEdges.length > 0 || children.length > 0) {
        get().showConfirm({
          title: t(lang, 'confirm.delete_nodes.title'),
          description: t(lang, 'confirm.delete_nodes.desc', { nodes: ids.length, edges: connectedEdges.length + children.length }),
          confirmLabel: t(lang, 'confirm.confirm'),
          cancelLabel: t(lang, 'confirm.cancel'),
          isDestructive: true,
          onConfirm: () => {
            get().deleteSelection();
            get().closeConfirm();
          },
          onCancel: () => get().closeConfirm(),
        });
      } else {
        get().deleteSelection();
      }
    },
    selectAll: () => { const { nodes } = get(); set((s) => { s.nodes = nodes.map((n) => (n.selected ? n : { ...n, selected: true })); }); },

    setTenant: (tenant) => set((s) => { s.tenant = tenant; s.tenant_id = tenant.tenant_id; s.revision++; }),
    rename: (name) => set((s) => { s.project = { ...s.project, name }; s.revision++; }),
    loadProject: (p) => set((s) => {
      s.nodes = p.nodes; s.edges = p.edges; s.tenant = p.tenant; s.tenant_id = p.tenant.tenant_id; s.horizon = p.horizon; s.configs = p.configs;
      s.project = { id: p.id, name: p.name, created_at: p.created_at }; s.history = emptyHistory(); s.selected = null; s.rejection = null; s.compat = null; s.dragActive = false; s.revision = 0;
    }),
    toProject: () => {
      const s = get();
      return { format_version: CURRENT_FORMAT_VERSION, app: 'socroot-topology-studio', id: s.project.id, name: s.project.name, tenant: s.tenant, horizon: s.horizon,
        created_at: s.project.created_at, updated_at: new Date().toISOString(), nodes: stripTransient(s.nodes), edges: stripEdges(s.edges), configs: s.configs };
    },
  };
}));

/** Pure selector helpers (kept out of the store so unrelated renders never recompute them). */
export const problemsOf = (nodes: SNode[], edges: SEdge[], tenant_id: string): Problem[] => collectProblems(nodes, edges, { tenant_id });
export { errorCount };

declare global {
  interface Window {
    __STUDIO_STORE__?: typeof useStudio;
  }
}

if (typeof window !== 'undefined') {
  window.__STUDIO_STORE__ = useStudio;
}
