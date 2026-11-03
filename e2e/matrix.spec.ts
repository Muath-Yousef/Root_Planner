import { test, expect } from '@playwright/test';

const VIEWPORTS = [1024, 1280, 1440];
const DIRECTIONS: ('ltr' | 'rtl')[] = ['ltr', 'rtl'];
const THEMES: ('dark' | 'light')[] = ['dark', 'light'];

test.describe('Responsive Matrix (Viewports × Direction × Theme)', () => {
  for (const width of VIEWPORTS) {
    for (const dir of DIRECTIONS) {
      for (const theme of THEMES) {
        test(`Matrix: ${width}px | ${dir.toUpperCase()} | ${theme}`, async ({ page }) => {
          await page.setViewportSize({ width, height: 800 });
          await page.goto('/');

          // Open reference department
          const refBtn = page.locator('button', { hasText: 'Reference Department' }).or(page.locator('button', { hasText: 'القسم المرجعي' })).first();
          await refBtn.click();
          await page.waitForSelector('.react-flow');

          // Dismiss tour if present
          const skipBtn = page.locator('button', { hasText: 'Skip' }).or(page.locator('button', { hasText: 'تخطي' }));
          if (await skipBtn.isVisible()) {
            await skipBtn.click();
          }

          // Set direction & theme via DOM / buttons
          await page.evaluate(({ d, t }) => {
            document.documentElement.dir = d;
            if (t === 'light') {
              document.documentElement.classList.add('light');
              document.documentElement.classList.remove('dark');
            } else {
              document.documentElement.classList.add('dark');
              document.documentElement.classList.remove('light');
            }
          }, { d: dir, t: theme });

          await page.waitForTimeout(200);

          // 1. Check canvas has no horizontal scrollbar on root
          const hasNoHScroll = await page.evaluate(() => {
            return document.documentElement.scrollWidth <= window.innerWidth + 2;
          });
          expect(hasNoHScroll, `Window has horizontal scrollbar at ${width}px`).toBe(true);

          // 2. Check side panel collapse behavior (< 1100 px must be collapsed)
          const aside = page.locator('aside');
          if (width < 1100) {
            expect(await aside.isVisible()).toBe(false);
          } else {
            expect(await aside.isVisible()).toBe(true);
          }

          // 3. Read bounding boxes: top-bar clusters must not overlap
          const clusters = await page.locator('header > [role="group"]').all();
          const boxes = [];
          for (const c of clusters) {
            if (await c.isVisible()) {
              const box = await c.boundingBox();
              if (box && box.width > 0 && box.height > 0) {
                boxes.push(box);
              }
            }
          }

          // Check that no two bounding boxes on the same line overlap
          for (let i = 0; i < boxes.length; i++) {
            for (let j = i + 1; j < boxes.length; j++) {
              const b1 = boxes[i];
              const b2 = boxes[j];

              // Check if they are on the same vertical line/band
              const sameRow = Math.abs(b1.y - b2.y) < Math.min(b1.height, b2.height) * 0.5;
              if (sameRow) {
                const overlap = Math.max(0, Math.min(b1.x + b1.width, b2.x + b2.width) - Math.max(b1.x, b2.x));
                expect(overlap, `Top bar clusters overlap between index ${i} and ${j}`).toBeLessThanOrEqual(2);
              }
            }
          }

          // 4. Save screenshot per matrix cell
          await page.screenshot({
            path: `screenshots/matrix-${width}-${dir}-${theme}.png`,
            fullPage: false,
          });
        });
      }
    }
  }
});
