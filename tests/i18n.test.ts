import { describe, expect, it } from 'vitest';
import { DICTIONARIES, applyLang, dirOf, t } from '../src/i18n';
import { en } from '../src/i18n/en';

describe('i18n', () => {
  it('Arabic has exactly the English keys, none empty', () => {
    expect(Object.keys(DICTIONARIES.ar).sort()).toEqual(Object.keys(en).sort());
    for (const v of Object.values(DICTIONARIES.ar)) expect(v.trim().length).toBeGreaterThan(0);
  });
  it('every {placeholder} in English exists in Arabic (and vice versa)', () => {
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const k of Object.keys(en) as (keyof typeof en)[]) expect(ph(DICTIONARIES.ar[k])).toEqual(ph(en[k]));
  });
  it('interpolates and keeps technical codes untouched', () => {
    expect(t('en', 'cable.blocked', { code: 'POL_DRF_HARD_01' })).toBe('Connection blocked (POL_DRF_HARD_01)');
    expect(t('ar', 'cable.blocked', { code: 'POL_DRF_HARD_01' })).toContain('POL_DRF_HARD_01');
    expect(t('en', 'cable.fix')).toBe('Fix: {fix}');
  });
  it('switching language flips direction', () => {
    const root = { lang: 'en', dir: 'ltr' }; applyLang(root, 'ar'); expect(root).toEqual({ lang: 'ar', dir: 'rtl' });
    applyLang(root, 'en'); expect(dirOf('en')).toBe('ltr'); expect(root.dir).toBe('ltr');
  });
});
