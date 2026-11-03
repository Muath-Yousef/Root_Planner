import { useEffect } from 'react';
import { useStudio } from '../../store/useStudioStore';
import { SHORTCUTS_TABLE } from './shortcutsData';

export { SHORTCUTS_TABLE };

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || !!t.closest('.cm-editor'));

/** Central shortcuts hook matching SHORTCUTS_TABLE */
export function useShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStudio.getState(),
        mod = e.ctrlKey || e.metaKey,
        k = e.key.toLowerCase();
      if (mod && k === 'k') {
        e.preventDefault();
        s.setCommandPaletteOpen(true);
        return;
      }
      if (typing(e.target)) return;

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        s.setHelpSheetOpen(true);
        return;
      }

      if (mod && k === 'l') {
        e.preventDefault();
        s.autoLayoutCanvas();
      } else if (mod && k === 'z') {
        e.preventDefault();
        (e.shiftKey ? s.redo : s.undo)();
      } else if (mod && k === 'y') {
        e.preventDefault();
        s.redo();
      } else if (mod && k === 'c') {
        s.copy();
      } else if (mod && k === 'v') {
        e.preventDefault();
        s.paste();
      } else if (mod && k === 'd') {
        e.preventDefault();
        s.duplicate();
      } else if (mod && k === 'a') {
        e.preventDefault();
        s.selectAll();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        s.requestDeleteSelection();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
