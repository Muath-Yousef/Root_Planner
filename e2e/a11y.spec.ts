import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Automated Accessibility Audits (axe-core)', () => {
  test('1. StartScreen has 0 serious or critical violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('main');

    const results = await new AxeBuilder({ page }).analyze();
    const violations = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(violations, `Violations: ${JSON.stringify(violations, null, 2)}`).toEqual([]);
  });

  test('2. Studio canvas with reference department has 0 serious or critical violations', async ({ page }) => {
    await page.goto('/');
    // Click reference template to open studio
    const refBtn = page.locator('button', { hasText: 'Reference Department' }).or(page.locator('button', { hasText: 'القسم المرجعي' })).first();
    await refBtn.click();

    // Wait for canvas to load
    await page.waitForSelector('.react-flow');

    // Dismiss tour if present
    const skipBtn = page.locator('button', { hasText: 'Skip' }).or(page.locator('button', { hasText: 'تخطي' }));
    if (await skipBtn.isVisible()) {
      await skipBtn.click();
    }

    const results = await new AxeBuilder({ page })
      .exclude('.react-flow__attribution')
      .analyze();

    const violations = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(violations, `Violations: ${JSON.stringify(violations, null, 2)}`).toEqual([]);
  });

  test('3. Command Palette Modal has 0 serious or critical violations', async ({ page }) => {
    await page.goto('/');
    const refBtn = page.locator('button', { hasText: 'Reference Department' }).or(page.locator('button', { hasText: 'القسم المرجعي' })).first();
    await refBtn.click();
    await page.waitForSelector('.react-flow');

    // Open command palette via Ctrl+K / Meta+K
    await page.keyboard.press('ControlOrMeta+KeyK');
    await page.waitForSelector('[role="dialog"]');

    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .analyze();

    const violations = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(violations, `Violations: ${JSON.stringify(violations, null, 2)}`).toEqual([]);
  });

  test('4. Export Bundle Modal has 0 serious or critical violations', async ({ page }) => {
    await page.goto('/');
    const refBtn = page.locator('button', { hasText: 'Reference Department' }).or(page.locator('button', { hasText: 'القسم المرجعي' })).first();
    await refBtn.click();
    await page.waitForSelector('.react-flow');

    // Click Export button
    const exportBtn = page.locator('button[aria-label="Export ZIP bundle"]').or(page.locator('button[aria-label="تصدير حزمة ZIP"]'));
    if (await exportBtn.isVisible()) {
      await exportBtn.click();
      await page.waitForSelector('[role="dialog"]');

      const results = await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .analyze();

      const violations = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical'
      );
      expect(violations, `Violations: ${JSON.stringify(violations, null, 2)}`).toEqual([]);
    }
  });
});
