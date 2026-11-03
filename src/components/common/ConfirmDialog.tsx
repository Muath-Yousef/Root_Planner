import React from 'react';
import { useModalA11y } from '../layout/useModalA11y';
import { useT } from '../../i18n/useT';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel,
  isDestructive = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const tr = useT();
  const dialogRef = useModalA11y<HTMLDivElement>(isOpen, onCancel);

  if (!isOpen) return null;

  const resolvedConfirmLabel = confirmLabel ?? tr('confirm.confirm');
  const resolvedCancelLabel = cancelLabel ?? tr('confirm.cancel');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <div
        ref={dialogRef}
        className={`w-full max-w-md rounded-xl border bg-slate-900 p-5 shadow-2xl transition-all ${
          isDestructive ? 'border-rose-700/60 shadow-rose-950/40' : 'border-slate-700 shadow-slate-950/40'
        }`}
      >
        <div className="flex items-center gap-2">
          {isDestructive && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-950 border border-rose-800 text-sm font-bold text-rose-400">
              ⚠
            </span>
          )}
          <h2 id="confirm-dialog-title" className="text-base font-bold text-slate-100" dir="auto">
            {title}
          </h2>
        </div>

        <div id="confirm-dialog-desc" className="mt-3 text-xs leading-relaxed text-slate-300" dir="auto">
          {description}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded bg-slate-800 px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            {resolvedCancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
            }}
            className={`rounded px-4 py-1.5 text-xs font-bold transition-colors focus:outline-none focus:ring-2 ${
              isDestructive
                ? 'bg-rose-600 text-white hover:bg-rose-500 focus:ring-rose-400 shadow-md shadow-rose-950'
                : 'bg-sky-600 text-white hover:bg-sky-500 focus:ring-sky-400'
            }`}
          >
            {resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
