import { useEffect, useState } from 'react';
import { applyLang } from './i18n';
import { lastProjectId, loadProject } from './persistence/projectStore';
import { useStudio } from './store/useStudioStore';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { StudioLayout } from './components/layout/StudioLayout';
import { StartScreen } from './components/onboarding/StartScreen';

type View = 'loading' | 'start' | 'studio';

/** Boot: restore the last saved company if there is one (page reload keeps the diagram), otherwise show the start screen. */
export default function App() {
  const [view, setView] = useState<View>('loading');
  const lang = useStudio((s) => s.lang);
  const theme = useStudio((s) => s.theme);

  useEffect(() => {
    applyLang(document.documentElement, lang);
  }, [lang]);

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const id = await lastProjectId();
        const p = id ? await loadProject(id) : null;
        if (!alive) return;
        if (p) {
          useStudio.getState().loadProject(p);
          setView('studio');
        } else setView('start');
      } catch {
        if (alive) setView('start');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <ErrorBoundary>
      {view === 'loading' ? (
        <div className="p-6 text-slate-400" role="status">
          …
        </div>
      ) : view === 'start' ? (
        <StartScreen onOpen={() => setView('studio')} />
      ) : (
        <StudioLayout onHome={() => setView('start')} />
      )}
    </ErrorBoundary>
  );
}
