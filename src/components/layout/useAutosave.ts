import { useEffect, useState } from 'react';
import { createAutosaver } from '../../persistence/autosave';
import { saveProject } from '../../persistence/projectStore';
import { useStudio } from '../../store/useStudioStore';
import type { ProjectFile } from '../../types';

export type SaveStatus = 'saved' | 'saving';
/** Watches `revision` (content changes only), saves 800 ms after the last change, and flushes when the tab is hidden or closed. */
export function useAutosave(): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>('saved');
  useEffect(() => {
    let alive = true;
    const saver = createAutosaver<ProjectFile>(async (p) => {
      await saveProject(p);
      if (alive) setStatus('saved');
    }, 800);
    let last = useStudio.getState().revision;
    const unsub = useStudio.subscribe((s) => {
      if (s.revision !== last) {
        last = s.revision;
        if (alive) setStatus('saving');
        saver.schedule(s.toProject());
      }
    });
    const flush = () => { void saver.flush(); };
    if (typeof window !== 'undefined') window.addEventListener('beforeunload', flush);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', flush);
    return () => {
      alive = false;
      unsub();
      if (typeof window !== 'undefined') window.removeEventListener('beforeunload', flush);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', flush);
    };
  }, []);
  return status;
}
