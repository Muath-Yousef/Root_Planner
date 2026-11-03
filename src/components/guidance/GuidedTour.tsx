import { useState } from 'react';
import { useStudio } from '../../store/useStudioStore';
import { useModalA11y } from '../layout/useModalA11y';
import { useT } from '../../i18n/useT';
import { set } from 'idb-keyval';

export function GuidedTour() {
  const tr = useT();
  const tourOpen = useStudio((s) => s.tourOpen);
  const setTourOpen = useStudio((s) => s.setTourOpen);
  const [step, setStep] = useState(0);

  const dialogRef = useModalA11y<HTMLDivElement>(tourOpen, () => handleDismiss());

  if (!tourOpen) return null;

  const STEPS = [
    {
      titleKey: 'tour.step.dock.title' as const,
      descKey: 'tour.step.dock.desc' as const,
      badge: 'DOCK',
      icon: '🧩',
    },
    {
      titleKey: 'tour.step.canvas.title' as const,
      descKey: 'tour.step.canvas.desc' as const,
      badge: 'CANVAS',
      icon: '📐',
    },
    {
      titleKey: 'tour.step.cable.title' as const,
      descKey: 'tour.step.cable.desc' as const,
      badge: 'CABLES',
      icon: '⚡',
    },
    {
      titleKey: 'tour.step.inspector.title' as const,
      descKey: 'tour.step.inspector.desc' as const,
      badge: 'INSPECTOR',
      icon: '🔍',
    },
    {
      titleKey: 'tour.step.simulation.title' as const,
      descKey: 'tour.step.simulation.desc' as const,
      badge: 'SIMULATION',
      icon: '🚀',
    },
  ];

  const handleDismiss = () => {
    void set('socroot:tour_seen', true);
    setTourOpen(false);
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleDismiss();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const cur = STEPS[step];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-lg rounded-2xl border border-sky-500/40 bg-slate-900 p-6 shadow-2xl shadow-sky-950/50 flex flex-col transition-all"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden="true">
              {cur.icon}
            </span>
            <span className="font-mono text-xs font-bold text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800">
              {cur.badge}
            </span>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {step + 1} / {STEPS.length}
          </span>
        </div>

        <div className="my-5 space-y-2">
          <h2 id="tour-modal-title" className="text-lg font-bold text-slate-100" dir="auto">
            {tr(cur.titleKey)}
          </h2>
          <p className="text-xs leading-relaxed text-slate-300" dir="auto">
            {tr(cur.descKey)}
          </p>
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 py-2">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-2 rounded-full transition-all ${
                i === step ? 'w-6 bg-sky-500' : 'w-2 bg-slate-700 hover:bg-slate-600'
              }`}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        {/* Footer controls */}
        <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-4">
          <button
            onClick={handleDismiss}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400 rounded px-2 py-1"
          >
            {tr('tour.skip')}
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={handleBack}
                className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400 transition-colors"
              >
                {tr('tour.back')}
              </button>
            )}
            <button
              onClick={handleNext}
              className="rounded bg-sky-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-400 transition-colors shadow-md shadow-sky-950"
            >
              {step === STEPS.length - 1 ? tr('tour.finish') : tr('tour.next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
