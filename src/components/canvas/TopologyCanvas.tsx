import { useState, useCallback, useMemo } from 'react';
import { Background, Controls, MiniMap, ReactFlow, useReactFlow } from '@xyflow/react';
import { useStudio } from '../../store/useStudioStore';
import { CABLE_DEFS, CABLE_KINDS } from '../../registry';
import { useT } from '../../i18n/useT';
import { useProblems } from '../../store/useProblems';
import { translateEngineMessage } from '../../i18n/messages';
import { edgeTypes, nodeTypes } from './nodeTypes';
import { ContextMenu } from './ContextMenu';
import { SelectionToolbar } from './SelectionToolbar';
import { START_TEMPLATES, createProject } from '../../presets/startTemplates';
import type { SNode } from '../../types';

export function TopologyCanvas() {
  const nodes = useStudio((s) => s.nodes);
  const edges = useStudio((s) => s.edges);
  const rejection = useStudio((s) => s.rejection);
  const onNodesChange = useStudio((s) => s.onNodesChange);
  const onEdgesChange = useStudio((s) => s.onEdgesChange);
  const connect = useStudio((s) => s.connect);
  const deployRole = useStudio((s) => s.deployRole);
  const dismiss = useStudio((s) => s.dismiss);
  const startDrag = useStudio((s) => s.startDrag);
  const endDrag = useStudio((s) => s.endDrag);
  const openInspector = useStudio((s) => s.openInspector);
  const activeActorNodeId = useStudio((s) => s.activeActorNodeId);
  const theme = useStudio((s) => s.theme);
  const lang = useStudio((s) => s.lang);
  const snapToGrid = useStudio((s) => s.snapToGrid);
  const setSnapToGrid = useStudio((s) => s.setSnapToGrid);
  const reducedMotion = useStudio((s) => s.reducedMotion);
  const setReducedMotion = useStudio((s) => s.setReducedMotion);
  const dimUnrelated = useStudio((s) => s.dimUnrelated);
  const setDimUnrelated = useStudio((s) => s.setDimUnrelated);
  const setCommandPaletteOpen = useStudio((s) => s.setCommandPaletteOpen);
  const alignSelected = useStudio((s) => s.alignSelected);
  const distributeSelected = useStudio((s) => s.distributeSelected);
  const loadProject = useStudio((s) => s.loadProject);
  const tenant_id = useStudio((s) => s.tenant_id);

  const tr = useT();
  const { screenToFlowPosition, fitView, setCenter } = useReactFlow();
  const problems = useProblems();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId?: string } | null>(null);
  const [showMiniMap, setShowMiniMap] = useState<boolean>(true);
  const [showLegend, setShowLegend] = useState<boolean>(false);

  const selectedNodes = useMemo(() => nodes.filter((n) => n.selected), [nodes]);

  // Memoized error nodes for high performance (supports 300+ nodes)
  const errorNodeIds = useMemo(() => {
    const set = new Set<string>();
    for (const p of problems) {
      if (p.severity === 'error' && p.nodeId) set.add(p.nodeId);
    }
    return set;
  }, [problems]);

  const nodeColor = useCallback(
    (n: SNode) => {
      if (n.data?.kind === 'zone') return 'transparent';
      if (errorNodeIds.has(n.id)) return '#ef4444';
      if (
        activeActorNodeId &&
        (n.id === activeActorNodeId ||
          n.data?.employee?.contract?.employee_id === activeActorNodeId ||
          n.data?.role === activeActorNodeId)
      ) {
        return '#f59e0b';
      }
      switch (n.data?.kind) {
        case 'founder':
          return '#f59e0b';
        case 'orchestrator':
          return '#fcd34d';
        case 'manager':
          return '#38bdf8';
        case 'employee':
          return '#06b6d4';
        case 'guard':
          return '#f43f5e';
        case 'memory':
          return '#a855f7';
        case 'external':
          return '#10b981';
        default:
          return '#64748b';
      }
    },
    [errorNodeIds, activeActorNodeId]
  );

  const nodeStrokeColor = useCallback((n: SNode) => {
    if (n.data?.kind === 'zone') return '#64748b';
    return '#090d16';
  }, []);

  const handleFocusActor = () => {
    if (!activeActorNodeId) return;
    const actorNode = nodes.find(
      (n) =>
        n.id === activeActorNodeId ||
        n.data?.employee?.contract?.employee_id === activeActorNodeId ||
        n.data?.role === activeActorNodeId
    );
    if (actorNode) {
      setCenter(actorNode.position.x + 80, actorNode.position.y + 40, { zoom: 1.2, duration: 600 });
    }
  };

  const handleDeployStarter = () => {
    const res = createProject({ name: 'Opportunity Acquisition', tenant_id, template: 'reference' });
    if (res.ok) {
      loadProject(res.project);
    }
  };

  return (
    <div
      className="relative flex-1 select-none overflow-hidden"
      onClick={() => setContextMenu(null)}
      onDoubleClick={(e) => {
        // Double click empty canvas opens command palette in add component mode
        if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('react-flow__pane')) {
          setCommandPaletteOpen(true);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('application/socroot');
        if (id) {
          const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
          deployRole(id, pos);
        }
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={connect}
        onConnectStart={(_, p) => p.nodeId && startDrag(p.nodeId, p.handleId)}
        onConnectEnd={endDrag}
        onNodeDoubleClick={(_, n) => openInspector(n.id)}
        onNodeContextMenu={(e, n) => {
          e.preventDefault();
          e.stopPropagation();
          setContextMenu({ x: e.clientX, y: e.clientY, nodeId: n.id });
        }}
        snapToGrid={snapToGrid}
        snapGrid={[16, 16]}
        deleteKeyCode={null}
        fitView
        colorMode={theme === 'light' ? 'light' : 'dark'}
      >
        <Background gap={snapToGrid ? 16 : 24} />
        <Controls />
        {showMiniMap && (
          <MiniMap<SNode>
            nodeColor={nodeColor}
            nodeStrokeColor={nodeStrokeColor}
            nodeBorderRadius={4}
            pannable
            zoomable
            position={lang === 'ar' ? 'bottom-left' : 'bottom-right'}
            maskColor={theme === 'light' ? 'rgba(241, 245, 249, 0.75)' : 'rgba(9, 13, 22, 0.75)'}
            style={{
              backgroundColor: theme === 'light' ? '#ffffff' : '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
            }}
          />
        )}
      </ReactFlow>

      {/* Empty Canvas Banner Hint */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/60 p-6 backdrop-blur-xs text-center">
          <div className="max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-900/90 p-8 shadow-2xl">
            <span className="text-4xl" aria-hidden="true">🏛️</span>
            <h2 className="text-lg font-bold text-slate-100" dir="auto">{tr('canvas.empty.title')}</h2>
            <p className="text-xs text-slate-300 leading-relaxed" dir="auto">{tr('canvas.empty.desc')}</p>
            <button
              onClick={handleDeployStarter}
              className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-sky-500 shadow-lg shadow-sky-950 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              🚀 {tr('canvas.empty.action')}
            </button>
          </div>
        </div>
      )}

      {/* Floating Selection Toolbar for Alignment, Distribute, Copy, Delete */}
      <SelectionToolbar />

      {/* MiniMap & View Canvas Toolbar */}
      <div className="absolute top-3 start-3 z-10 flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/90 p-1 backdrop-blur-xs text-xs shadow-lg">
        <button
          onClick={() => fitView({ duration: 500 })}
          className="rounded px-2 py-1 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          title={tr('canvas.fit_view')}
        >
          ⛶ {tr('canvas.fit')}
        </button>
        {activeActorNodeId && (
          <button
            onClick={handleFocusActor}
            className="rounded bg-amber-950/80 border border-amber-800 px-2 py-1 text-amber-300 hover:bg-amber-900 hover:text-white transition-colors font-medium"
            title={tr('canvas.focus_actor')}
          >
            🎯 {tr('canvas.focus')}
          </button>
        )}
        <button
          onClick={() => setSnapToGrid(!snapToGrid)}
          className={`rounded px-2 py-1 transition-colors ${
            snapToGrid ? 'bg-sky-700 text-white font-medium' : 'text-slate-400 hover:bg-slate-800'
          }`}
          title={tr('top.snap')}
        >
          🧲 {tr('top.snap')}
        </button>
        <button
          onClick={() => setDimUnrelated(!dimUnrelated)}
          className={`rounded px-2 py-1 transition-colors ${
            dimUnrelated ? 'bg-sky-700 text-white font-medium' : 'text-slate-400 hover:bg-slate-800'
          }`}
          title={tr('top.dim_unrelated')}
        >
          👁️ {tr('top.dim_unrelated')}
        </button>
        <button
          onClick={() => setReducedMotion(!reducedMotion)}
          className={`rounded px-2 py-1 transition-colors ${
            reducedMotion ? 'bg-amber-600 text-white font-medium' : 'text-slate-400 hover:bg-slate-800'
          }`}
          title={tr('top.reduced_motion')}
        >
          ⚡ {tr('top.reduced_motion')}
        </button>
        <button
          onClick={() => setShowMiniMap(!showMiniMap)}
          className={`rounded px-2 py-1 transition-colors ${
            showMiniMap ? 'bg-sky-700 text-white font-medium' : 'text-slate-400 hover:bg-slate-800'
          }`}
          title={tr('canvas.minimap_toggle')}
        >
          🗺️ {tr('canvas.map')}
        </button>
        <button
          onClick={() => setShowLegend(!showLegend)}
          className={`rounded px-2 py-1 transition-colors ${
            showLegend ? 'bg-sky-700 text-white font-medium' : 'text-slate-400 hover:bg-slate-800'
          }`}
          title={tr('canvas.legend_toggle')}
        >
          🏷️ {tr('canvas.legend')}
        </button>
      </div>

      {/* Floating Cable Legend */}
      {showLegend && (
        <div className="absolute top-14 start-3 z-10 w-64 rounded-xl border border-slate-700 bg-slate-900/95 p-3 backdrop-blur-md shadow-2xl text-xs space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 font-semibold text-slate-200">
            <span>{tr('canvas.cable_legend')}</span>
            <button onClick={() => setShowLegend(false)} aria-label={tr('inspector.close')} className="text-slate-400 hover:text-white">✕</button>
          </div>
          <div className="space-y-1.5">
            {CABLE_KINDS.map((kind) => {
              const def = CABLE_DEFS[kind];
              return (
                <div key={kind} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: def.color }}
                  />
                  <div className="min-w-0 flex-1 truncate text-slate-300" title={def.description[lang]}>
                    <span className="font-medium">{def.label[lang] ?? kind}</span>
                    {def.dashed && <span className="ms-1 text-[10px] text-amber-400">({tr('cable.dashed')})</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          onClose={() => setContextMenu(null)}
        />
      )}

      {rejection && (
        <div
          role="alert"
          className="absolute start-1/2 top-4 z-20 w-[32rem] max-w-[92%] -translate-x-1/2 rounded-xl border border-rose-500 bg-rose-950/95 p-4 text-sm shadow-2xl backdrop-blur-sm"
        >
          <div className="flex items-center justify-between font-bold text-rose-200" dir="auto">
            <span>{tr('cable.blocked', { code: rejection.code })}</span>
            <span className="font-mono text-xs text-rose-400">{rejection.code}</span>
          </div>
          <p className="mt-1 text-slate-200" dir="auto">
            {translateEngineMessage(rejection.code, lang, rejection.reason)}
          </p>
          {rejection.fix && (
            <p className="mt-2 rounded bg-rose-900/60 p-2 text-xs text-rose-200 font-mono" dir="auto">
              💡 {tr('cable.fix', { fix: rejection.fix })}
            </p>
          )}
          <div className="mt-3 flex justify-end">
            <button
              onClick={dismiss}
              className="rounded bg-rose-900 px-3 py-1 text-xs text-white hover:bg-rose-800 transition-colors"
            >
              {tr('cable.dismiss')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
