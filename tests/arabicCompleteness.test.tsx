// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { en } from '../src/i18n/en';
import { ar } from '../src/i18n/ar';
import { t, dirOf } from '../src/i18n';
import { translateEngineMessage } from '../src/i18n/messages';

describe('Arabic Localization Completeness & Quality (§1.1, §1.3, §6.3)', () => {
  it('ensures every English dictionary key has a corresponding Arabic translation', () => {
    const enKeys = Object.keys(en);
    const arKeys = Object.keys(ar);

    expect(arKeys.length).toBe(enKeys.length);

    for (const key of enKeys) {
      const arVal = ar[key as keyof typeof ar];
      expect(arVal, `Missing translation for key: ${key}`).toBeDefined();
      expect(typeof arVal).toBe('string');
      expect(arVal.trim().length).toBeGreaterThan(0);
    }
  });

  it('verifies RTL direction resolution for Arabic and LTR for English', () => {
    expect(dirOf('ar')).toBe('rtl');
    expect(dirOf('en')).toBe('ltr');
  });

  it('translates simulation step 4+5 combined badges', () => {
    expect(t('ar', 'sim.step.4_5')).toBe('الخطوتان 4+5');
    expect(t('en', 'sim.step.4_5')).toBe('Steps 4+5');
  });

  it('translates engine error and security rejection codes into Arabic', () => {
    const cablingRejectAr = translateEngineMessage('POL_DRF_HARD_01', 'ar');
    expect(cablingRejectAr).toContain('قاعدة حتمية');
    expect(cablingRejectAr).toContain('الصائغ');

    const cliSyntaxAr = translateEngineMessage('CLI_SHELL_REJECTED', 'ar');
    expect(cliSyntaxAr).toContain('صيغ الشل');

    const policyDenyAr = translateEngineMessage('POL_DEFAULT_DENY', 'ar');
    expect(policyDenyAr).toContain('الإنكار الافتراضي');

    const breakGlassReplayAr = translateEngineMessage('BG_NONCE_REPLAY', 'ar');
    expect(breakGlassReplayAr).toContain('هجوم إعادة إرسال');
  });

  it('verifies parameters interpolation in translated Arabic strings', () => {
    const stepStr = t('ar', 'sim.progress', { n: 3, total: 9 });
    expect(stepStr).toContain('3');
    expect(stepStr).toContain('9');

    const cableBlocked = t('ar', 'cable.blocked', { code: 'POL_DRF_HARD_01' });
    expect(cableBlocked).toContain('تم منع التوصيل');
    expect(cableBlocked).toContain('POL_DRF_HARD_01');
  });

  it('verifies all Dock category and panel tab labels are localized in Arabic', () => {
    const categories = ['Command', 'Employees', 'Memory', 'Guards', 'External', 'Zones'];
    for (const cat of categories) {
      const key = `dock.cat.${cat}` as keyof typeof ar;
      expect(ar[key]).toBeDefined();
      expect(ar[key].length).toBeGreaterThan(0);
    }

    expect(ar['panel.tab.problems']).toBe('المشاكل');
    expect(ar['panel.tab.simulation']).toBe('المحاكاة');
    expect(ar['panel.tab.audit']).toBe('سلسلة التدقيق');
  });

  it('verifies all 15 palette command titles are translated into Arabic', () => {
    const paletteKeys = [
      'palette.cmd.mode',
      'palette.cmd.theme',
      'palette.cmd.lang',
      'palette.cmd.cli',
      'palette.cmd.breakglass',
      'palette.cmd.killplane',
      'palette.cmd.tenant',
      'palette.cmd.export',
      'palette.cmd.configs',
      'palette.cmd.autolayout',
      'palette.cmd.align',
      'palette.cmd.distribute',
      'palette.cmd.undo',
      'palette.cmd.redo',
      'palette.cmd.select_all',
      'palette.cmd.delete',
    ] as const;

    for (const k of paletteKeys) {
      expect(ar[k]).toBeDefined();
      // Ensure Arabic characters are present
      expect(/[\u0600-\u06FF]/.test(ar[k]), `Key ${k} does not contain Arabic text`).toBe(true);
    }
  });
});
