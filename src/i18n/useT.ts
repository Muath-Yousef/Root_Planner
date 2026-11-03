import { useCallback } from 'react';
import { useStudio } from '../store/useStudioStore';
import { t, type MessageKey } from './index';

/** `const tr = useT(); tr('sim.run')` — re-renders only when the language changes. */
export function useT() {
  const lang = useStudio((s) => s.lang);
  return useCallback((key: MessageKey, vars?: Record<string, string | number>) => t(lang, key, vars), [lang]);
}
