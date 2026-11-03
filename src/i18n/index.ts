import type { Lang } from '../types';
import { en, type MessageKey } from './en';
import { ar } from './ar';

export type { MessageKey };
export const DICTIONARIES: Record<Lang, Record<MessageKey, string>> = { en, ar };
export const dirOf = (lang: Lang): 'rtl' | 'ltr' => (lang === 'ar' ? 'rtl' : 'ltr');

/** Pure translation with `{name}` interpolation. A missing key falls back to English, then to the key itself. */
export function t(lang: Lang, key: MessageKey, vars: Record<string, string | number> = {}): string {
  const raw = DICTIONARIES[lang][key] ?? en[key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
/** Sets `lang`/`dir` on <html> so the whole layout (logical CSS properties) mirrors. Technical ids stay LTR via `dir="ltr"` on code elements. */
export function applyLang(root: { lang: string; dir: string }, lang: Lang): void { root.lang = lang; root.dir = dirOf(lang); }
