import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudio } from '../../../store/useStudioStore';
import { CABLE_DEFS, getRole, portsFor } from '../../../registry';
import { useT } from '../../../i18n/useT';
import type { CableKind, SNode } from '../../../types';

const TONE: Record<string, string> = {
  founder: 'border-amber-400',
  orchestrator: 'border-amber-300',
  manager: 'border-sky-400',
  employee: 'border-cyan-500',
  guard: 'border-rose-400',
  memory: 'border-violet-400',
  external: 'border-emerald-400',
};

/** Memoised: while another node is dragged this one re-renders only if its own dimming (`compat`) or the language/horizon changes. */
export const StudioNode = memo(function StudioNode({ id, data, selected }: NodeProps<SNode>) {
  const dim = useStudio((s) => (s.compat ? !s.compat.has(id) : false));
  const dimUnrelated = useStudio((s) => s.dimUnrelated);
  const selectedNodeId = useStudio((s) => s.selected);
  const reducedMotion = useStudio((s) => s.reducedMotion);
  const lang = useStudio((s) => s.lang);
  const studioHorizon = useStudio((s) => s.horizon);
  const activeActorNodeId = useStudio((s) => s.activeActorNodeId);
  const openInfoModal = useStudio((s) => s.openInfoModal);
  const tr = useT();

  const isDimmedUnrelated = dimUnrelated && selectedNodeId && selectedNodeId !== id && !selected;

  const ports = portsFor(data.kind, data.role);
  const ins = ports.filter((p) => p.direction === 'in');
  const outs = ports.filter((p) => p.direction === 'out');
  const def = getRole(data.role);

  const isHorizonDimmed =
    (studioHorizon === 'CURRENT' && def?.architecture_horizon !== 'CURRENT') ||
    (studioHorizon === 'TRANSITIONAL' && def?.architecture_horizon === 'TARGET');

  const empId = data.employee ? (data.employee.contract as { employee_id?: string })?.employee_id : undefined;
  const label = empId ?? (def?.label[lang] ?? data.label);

  const isActiveActor =
    activeActorNodeId === id ||
    (empId && activeActorNodeId === empId) ||
    (activeActorNodeId && data.role === activeActorNodeId);

  const row = (n: number, i: number) => `${((i + 1) * 100) / (n + 1)}%`;

  const portTooltip = (cable: CableKind, dir: 'in' | 'out') => {
    const cdef = CABLE_DEFS[cable];
    const dests = cdef.links
      .map((l) =>
        dir === 'out'
          ? l.to.roles?.join(', ') || l.to.kinds?.join(', ')
          : l.from.roles?.join(', ') || l.from.kinds?.join(', ')
      )
      .filter(Boolean)
      .join(' | ');
    return `${cdef.label[lang] ?? cable} [${dir.toUpperCase()}]\n${dests ? `Valid: ${dests}` : ''}`;
  };

  return (
    <div
      className={`relative rounded-md border-2 bg-slate-900 px-4 py-2 text-xs transition-all ${
        reducedMotion ? 'duration-0' : 'duration-300'
      } ${
        TONE[data.kind] ?? 'border-slate-500'
      } ${dim || isHorizonDimmed || isDimmedUnrelated ? 'opacity-35 scale-[0.98]' : 'opacity-100'} ${
        isHorizonDimmed ? 'border-dashed' : ''
      } ${
        isActiveActor
          ? `ring-4 ring-amber-400 ring-offset-2 ring-offset-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.6)] ${
              reducedMotion ? '' : 'animate-pulse'
            }`
          : ''
      }`}
      style={{ minHeight: Math.max(ins.length, outs.length) * 14 + 40 }}
    >
      {/* Target (IN) handles */}
      {ins.map((p, i) => (
        <Handle
          key={p.id}
          id={p.id}
          type="target"
          position={Position.Left}
          title={portTooltip(p.cable, 'in')}
          style={{
            top: row(ins.length, i),
            background: CABLE_DEFS[p.cable].color,
            width: 10,
            height: 10,
            border: '2px solid #090d16',
          }}
        />
      ))}

      {/* Header with Title & Info trigger */}
      <div className="flex items-center justify-between gap-1">
        <div className="font-semibold text-slate-100 truncate flex-1" dir="auto">
          {label}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openInfoModal(data.role);
          }}
          className="nodrag nopan flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] text-slate-400 hover:bg-sky-900 hover:text-sky-300 transition-colors"
          title={tr('component.info')}
          aria-label={tr('component.info')}
        >
          i
        </button>
      </div>

      {/* Role and status indicators */}
      <div className="text-slate-400 flex items-center gap-1 font-mono text-[10px]" dir="ltr">
        <span>{data.role}</span>
        {data.networkMode && <span className="text-cyan-400">· {data.networkMode}</span>}
        {def?.architecture_horizon && def.architecture_horizon !== 'CURRENT' && (
          <span className="text-amber-400 font-bold">· {def.architecture_horizon}</span>
        )}
      </div>

      {/* Source (OUT) handles */}
      {outs.map((p, i) => (
        <Handle
          key={p.id}
          id={p.id}
          type="source"
          position={Position.Right}
          title={portTooltip(p.cable, 'out')}
          style={{
            top: row(outs.length, i),
            background: CABLE_DEFS[p.cable].color,
            width: 10,
            height: 10,
            border: '2px solid #090d16',
          }}
        />
      ))}
    </div>
  );
});
