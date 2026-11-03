import { memo, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeResizer } from '@xyflow/react';
import { Maximize2, Shield, Box } from 'lucide-react';
import type { SNode } from '../../../types';
import { useStudio } from '../../../store/useStudioStore';

export const ZoneNode = memo(function ZoneNode({ id, data, selected, width, height }: NodeProps<SNode>) {
  const [hovered, setHovered] = useState(false);
  const lang = useStudio((s) => s.lang);
  const node = useStudio((s) => s.nodes.find((n) => n.id === id));

  // Determine current display dimensions (fallback to node style or default 360x240)
  const displayW = Math.round(width ?? (typeof node?.style?.width === 'number' ? node.style.width : 360));
  const displayH = Math.round(height ?? (typeof node?.style?.height === 'number' ? node.style.height : 240));

  const zoneKind = data.zone?.zone ?? 'line';
  const isolation = data.zone?.isolation ?? 'standard';

  const zoneTitles: Record<string, { ar: string; en: string }> = {
    line: { ar: 'قسم تنفيذي', en: 'Line department' },
    meta: { ar: 'قسم تشغيلي (Meta)', en: 'Meta department' },
    docker: { ar: 'حدّ Docker', en: 'Docker boundary' },
    untrusted: { ar: 'العالم غير الموثوق', en: 'Untrusted world' },
    dedicated: { ar: 'بيئة عميل مخصصة', en: 'Dedicated client env' },
  };

  const localizedZone = zoneTitles[zoneKind]?.[lang] ?? zoneKind;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group relative h-full w-full min-h-[100px] min-w-[180px] rounded-xl border-2 transition-all select-none ${
        selected
          ? 'border-sky-400 bg-sky-950/20 ring-2 ring-sky-400/40 shadow-lg shadow-sky-950/40'
          : hovered
            ? 'border-slate-500 bg-slate-800/30 shadow-md'
            : 'border-dashed border-slate-600/70 bg-slate-900/25'
      }`}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <NodeResizer
        nodeId={id}
        isVisible={Boolean(selected || hovered)}
        minWidth={180}
        minHeight={100}
        color="#38bdf8"
        lineClassName="!border-sky-400 !border-dashed !border-opacity-90"
        handleClassName="!w-3.5 !h-3.5 !rounded !bg-sky-400 !border-2 !border-slate-950 shadow-md hover:!scale-125 transition-transform"
      />

      {/* Header Bar */}
      <div className="flex items-center justify-between p-2.5 text-xs text-slate-300">
        <div className="flex items-center gap-1.5 font-medium">
          <Box className="h-3.5 w-3.5 text-sky-400 shrink-0" />
          <span className="font-semibold text-slate-200 truncate">{data.label}</span>
          <span className="rounded bg-slate-800/90 border border-slate-700/60 px-1.5 py-0.5 text-[10px] text-slate-300">
            {localizedZone}
          </span>
          {isolation && isolation !== 'standard' && (
            <span className="flex items-center gap-1 rounded bg-amber-950/70 border border-amber-600/40 px-1.5 py-0.5 text-[10px] text-amber-300">
              <Shield className="h-2.5 w-2.5" />
              <span>{isolation}</span>
            </span>
          )}
        </div>

        {/* Live dimension badge and resize hint */}
        <div
          className="flex items-center gap-1 rounded bg-slate-800/80 border border-slate-700/50 px-1.5 py-0.5 text-[10px] text-slate-400 font-mono opacity-85 group-hover:opacity-100 transition-opacity"
          dir="ltr"
          title={lang === 'ar' ? 'اسحب الحواف أو الزوايا بالماوس لتغيير الحجم' : 'Drag edges or corners to resize'}
        >
          <Maximize2 className="h-2.5 w-2.5 text-sky-400" />
          <span>{displayW} × {displayH}</span>
        </div>
      </div>

      {/* Subtle bottom corner resize grip hint */}
      <div
        className="pointer-events-none absolute bottom-1.5 end-1.5 p-0.5 opacity-35 group-hover:opacity-80 transition-opacity text-slate-400"
        dir="ltr"
        aria-hidden="true"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-slate-400">
          <circle cx="8" cy="8" r="1.2" fill="currentColor" />
          <circle cx="8" cy="4" r="1.2" fill="currentColor" />
          <circle cx="4" cy="8" r="1.2" fill="currentColor" />
          <circle cx="8" cy="0" r="1.2" fill="currentColor" />
          <circle cx="4" cy="4" r="1.2" fill="currentColor" />
          <circle cx="0" cy="8" r="1.2" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
});
