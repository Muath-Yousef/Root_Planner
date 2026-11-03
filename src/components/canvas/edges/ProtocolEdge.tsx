import { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useStore, type EdgeProps } from '@xyflow/react';
import { CABLE_DEFS } from '../../../registry';
import { useStudio } from '../../../store/useStudioStore';
import type { SEdge } from '../../../types';

export function ProtocolEdge(p: EdgeProps<SEdge>) {
  const [path, labelX, labelY] = getBezierPath(p);
  const [isHovered, setIsHovered] = useState(false);
  const def = CABLE_DEFS[p.data!.kind];
  const lang = useStudio((s) => s.lang);
  const openCableModal = useStudio((s) => s.openCableModal);
  const activePulsingCableId = useStudio((s) => s.activePulsingCableId);
  const reducedMotion = useStudio((s) => s.reducedMotion);
  const dimUnrelated = useStudio((s) => s.dimUnrelated);
  const selectedNodeId = useStudio((s) => s.selected);

  const zoomRaw = useStore((s) => s.transform?.[2]);
  const zoom = zoomRaw && zoomRaw > 0 ? zoomRaw : 1;
  const isPulsing = activePulsingCableId === p.id && !reducedMotion;

  // Dimming unrelated edges if dimUnrelated is enabled and a node is selected
  const isRelated =
    !selectedNodeId ||
    p.source === selectedNodeId ||
    p.target === selectedNodeId ||
    p.selected;
  const isDimmed = dimUnrelated && selectedNodeId && !isRelated;

  // Show edge labels on hover, or if selected, or if zoom > 0.65
  const showLabel = isHovered || p.selected || zoom > 0.65 || isPulsing;

  return (
    <>
      {/* Invisible wider interaction path for hover */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        className="cursor-pointer"
        style={{ pointerEvents: 'stroke' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={(e) => {
          e.stopPropagation();
          openCableModal(p.id);
        }}
      />
      <BaseEdge
        id={p.id}
        path={path}
        style={{
          stroke: def.color,
          strokeWidth: isPulsing ? 3.5 : 2,
          strokeDasharray: def.dashArray ?? (def.dashed ? '6 4' : undefined),
          filter: isPulsing ? `drop-shadow(0 0 8px ${def.color})` : undefined,
          transition: reducedMotion ? 'none' : 'all 0.3s ease',
          opacity: isDimmed ? 0.2 : 1,
        }}
        className={isPulsing ? 'animate-pulse' : ''}
      />
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              opacity: isDimmed ? 0.3 : 1,
            }}
            className="nodrag nopan cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              openCableModal(p.id);
            }}
          >
            <div
              className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-mono shadow-lg border transition-all hover:scale-110 ${
                isPulsing ? 'ring-2 ring-white scale-110 shadow-sky-500/50' : 'opacity-90 hover:opacity-100'
              }`}
              style={{
                backgroundColor: '#090d16',
                borderColor: def.color,
                color: def.color === '#ef4b4b' ? '#f87171' : def.color,
              }}
              title={`${def.label[lang] ?? p.data!.kind}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${isPulsing ? 'animate-ping' : ''}`}
                style={{ backgroundColor: def.color }}
              />
              <span className="font-semibold">{def.label[lang] ?? p.data!.kind}</span>
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
