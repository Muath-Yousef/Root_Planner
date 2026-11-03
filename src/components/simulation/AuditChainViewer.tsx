import { useState } from 'react';
import type { AuditRecord } from '../../engine/auditLogger';
import { useT } from '../../i18n/useT';

const ROW = 20, VIEW = 160, OVERSCAN = 4;
export interface AuditChainViewerProps { records: AuditRecord[]; status: { ok: boolean; text: string } | null; onVerify: () => void; onTamper: () => void }

/** Windowed list: only the rows in view are rendered, so a long log stays cheap. */
export function AuditChainViewer({ records, status, onVerify, onTamper }: AuditChainViewerProps) {
  const tr = useT();
  const [top, setTop] = useState(0);
  const start = Math.max(0, Math.floor(top / ROW) - OVERSCAN), end = Math.min(records.length, Math.ceil((top + VIEW) / ROW) + OVERSCAN);
  return (
    <section aria-label={tr('sim.audit')} className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">{tr('sim.audit')}</h3>
        <button onClick={onVerify} className="ms-auto rounded bg-slate-700 px-2 py-0.5 text-xs">{tr('sim.verify')}</button>
        <button onClick={onTamper} className="rounded bg-rose-800 px-2 py-0.5 text-xs">{tr('sim.tamper')}</button>
      </div>
      {status && <p role="status" dir="ltr" className={`text-xs ${status.ok ? 'text-emerald-400' : 'font-semibold text-rose-400'}`}>{status.text}</p>}
      {records.length === 0 ? <p className="text-xs text-slate-400">{tr('sim.audit.empty')}</p> : (
        <div onScroll={(e) => setTop(e.currentTarget.scrollTop)} style={{ height: VIEW }} className="overflow-y-auto font-mono text-xs" dir="ltr">
          <div style={{ height: start * ROW }} />
          {records.slice(start, end).map((r, i) => <div key={r.log_id} style={{ height: ROW }} className="truncate">{start + i}. {r.event_type} <span className="text-slate-500">{r.entry_hash.slice(0, 10)}</span></div>)}
          <div style={{ height: (records.length - end) * ROW }} />
        </div>
      )}
    </section>
  );
}
