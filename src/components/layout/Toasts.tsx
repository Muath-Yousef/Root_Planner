import { useEffect, useRef, useState } from 'react';
import { useStudio, type ToastItem } from '../../store/useStudioStore';

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [paused, setPaused] = useState(false);
  const [remaining, setRemaining] = useState(toast.duration ?? 4500);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (paused) return;
    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      onDismiss(toast.id);
    }, remaining);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [paused, remaining, onDismiss, toast.id]);

  const handleMouseEnter = () => {
    setPaused(true);
    const elapsed = Date.now() - startTimeRef.current;
    setRemaining((prev) => Math.max(600, prev - elapsed));
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleMouseLeave = () => {
    setPaused(false);
  };

  const kindStyles = {
    info: 'border-sky-600/80 bg-slate-900 text-sky-200 shadow-sky-950/50',
    success: 'border-emerald-600/80 bg-slate-900 text-emerald-200 shadow-emerald-950/50',
    warning: 'border-amber-600/80 bg-slate-900 text-amber-200 shadow-amber-950/50',
    error: 'border-rose-600/80 bg-slate-900 text-rose-200 shadow-rose-950/50',
  }[toast.kind];

  const kindIcons = {
    info: 'ℹ',
    success: '✓',
    warning: '⚠',
    error: '✖',
  }[toast.kind];

  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`pointer-events-auto flex items-center gap-2 rounded-lg border px-3 py-2 text-xs shadow-xl transition-all ${kindStyles}`}
    >
      <span className="font-bold text-sm leading-none" aria-hidden="true">
        {kindIcons}
      </span>
      <span className="max-w-xs font-medium text-slate-100" dir="auto">
        {toast.message}
      </span>
      {toast.action && (
        <button
          onClick={() => {
            toast.action?.onClick();
            onDismiss(toast.id);
          }}
          className="ms-auto rounded bg-sky-600 px-2 py-0.5 text-xs font-bold text-white hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-400 transition-colors"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={() => onDismiss(toast.id)}
        className="ms-1 rounded p-1 text-slate-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-400 transition-colors"
        aria-label="Dismiss notification"
      >
        <span aria-hidden="true" className="text-base leading-none">×</span>
      </button>
    </div>
  );
}

export function Toasts() {
  const toasts = useStudio((s) => s.toasts);
  const dismissToast = useStudio((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <aside
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-8 start-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </aside>
  );
}
