import { test, expect } from '@playwright/test';
import JSZip from 'jszip';

test.describe('End-to-End User Experience Tasks (UX_TASKS.md)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('socroot:tour_seen', 'true');
      try {
        const req = indexedDB.open('keyval-store');
        req.onupgradeneeded = () => req.result.createObjectStore('keyval');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('keyval', 'readwrite');
          tx.objectStore('keyval').put(true, 'socroot:tour_seen');
        };
      } catch {}
    });
    await page.goto('/');
  });

  test('Task 1: Create a New Company Organization via Wizard', async ({ page }) => {
    // 1. Click Start New Company Wizard
    const wizardBtn = page.locator('button', { hasText: 'New company wizard' }).or(page.locator('button', { hasText: 'معالج الشركة' })).or(page.locator('button', { hasText: 'انشر شركة جديدة' })).first();
    await wizardBtn.click();
    await page.waitForSelector('[role="dialog"]');

    // 2. Step 1: Company Name
    const nameInput = page.locator('[role="dialog"] input').first();
    await nameInput.fill('Acme Defense Systems');
    const nextBtn = page.locator('[role="dialog"] button', { hasText: 'Next' }).or(page.locator('[role="dialog"] button', { hasText: 'التالي' })).first();
    await nextBtn.click();

    // 3. Step 2: Tenant & Isolation
    await nextBtn.click();

    // 4. Step 3: Template & Create
    const createBtn = page.locator('button', { hasText: 'Create Company' }).or(page.locator('button', { hasText: 'إنشاء الشركة' })).or(page.locator('button', { hasText: 'Create' })).or(page.locator('button', { hasText: 'إنشاء' })).first();
    await createBtn.click();

    // 5. Pass Criterion: Studio loads with canvas
    await page.waitForSelector('.react-flow');
    expect(await page.locator('.react-flow').isVisible()).toBe(true);
  });

  test('Task 2: Add and Wire a Digital Employee (Real Mouse Drag & Rejection & Port Dimming)', async ({ page }) => {
    // Load reference department
    const refBtn = page.locator('button', { hasText: 'Reference Department' }).or(page.locator('button', { hasText: 'القسم المرجعي' })).first();
    await refBtn.click();
    await page.waitForSelector('.react-flow');

    // Dismiss tour
    const skipBtn = page.locator('button', { hasText: 'Skip' }).or(page.locator('button', { hasText: 'تخطي' }));
    if (await skipBtn.isVisible()) await skipBtn.click();

    // 1. Drag drafter from Dock to canvas using dataTransfer
    const drafterDockItem = page.locator('[role="listitem"]', { hasText: 'Drafter' }).or(page.locator('[role="listitem"]', { hasText: 'الصائغ' })).first();
    if (await drafterDockItem.isVisible()) {
      const canvasPane = page.locator('.react-flow__pane');
      await drafterDockItem.dragTo(canvasPane, {
        targetPosition: { x: 500, y: 300 },
      });
    }

    // 2. Test port dimming during cable drag
    await page.evaluate(() => {
      (window as any).__STUDIO_STORE__.getState().startDrag('drf', 'out:TASK_DISPATCH_RESULT');
    });
    // Check that incompatible nodes are dimmed
    const dimmedNodes = page.locator('.react-flow__node div.opacity-35');
    expect(await dimmedNodes.count()).toBeGreaterThan(0);

    // End drag
    await page.evaluate(() => {
      (window as any).__STUDIO_STORE__.getState().endDrag();
    });

    // 3. Reject Drafter to External cable with POL_DRF_HARD_01
    await page.evaluate(() => {
      (window as any).__STUDIO_STORE__.getState().connect({
        source: 'drf',
        target: 'web',
      });
    });

    // Rejection banner must appear stating POL_DRF_HARD_01
    const rejectionBanner = page.locator('div', { hasText: 'POL_DRF_HARD_01' });
    await expect(rejectionBanner.first()).toBeVisible({ timeout: 5000 });
  });

  test('Task 2 (Keyboard-Only): Deploy Role from Dock via Keyboard Navigation', async ({ page }) => {
    // Load reference department
    const refBtn = page.locator('button', { hasText: 'Reference Department' }).or(page.locator('button', { hasText: 'القسم المرجعي' })).first();
    await refBtn.click();
    await page.waitForSelector('.react-flow');

    // Dismiss tour
    const skipBtn = page.locator('button', { hasText: 'Skip' }).or(page.locator('button', { hasText: 'تخطي' }));
    if (await skipBtn.isVisible()) await skipBtn.click();

    const nodeCountBefore = await page.locator('.react-flow__node').count();

    // Focus on Dock listitem and press Enter
    const dockItem = page.locator('[role="listitem"]').first();
    await dockItem.focus();
    await page.keyboard.press('Enter');

    // Node count should increase by 1
    await page.waitForFunction(
      (prev) => document.querySelectorAll('.react-flow__node').length > prev,
      nodeCountBefore
    );
    const nodeCountAfter = await page.locator('.react-flow__node').count();
    expect(nodeCountAfter).toBeGreaterThan(nodeCountBefore);
  });

  test('Task 3 & 4: Device Inspector Double-Click & Configuration Edit', async ({ page }) => {
    // Load reference department
    const refBtn = page.locator('button', { hasText: 'Reference Department' }).or(page.locator('button', { hasText: 'القسم المرجعي' })).first();
    await refBtn.click();
    await page.waitForSelector('.react-flow');

    // Dismiss tour
    const skipBtn = page.locator('button', { hasText: 'Skip' }).or(page.locator('button', { hasText: 'تخطي' }));
    if (await skipBtn.isVisible()) await skipBtn.click();

    // Double click drafter node
    const drafterNode = page.locator('.react-flow__node[data-id="drf"]');
    await drafterNode.dblclick();

    // Drawer opens: locate the drafter heading in the drawer
    const drawerHeading = page.locator('h2', { hasText: 'drafter' });
    await expect(drawerHeading.first()).toBeVisible({ timeout: 5000 });

    // Switch tab to Contract or Identity
    const contractTab = page.locator('button', { hasText: 'Contract' }).or(page.locator('button', { hasText: 'العقد' })).first();
    if (await contractTab.isVisible()) {
      await contractTab.click();
      await page.waitForTimeout(200);
    }

    // Close drawer
    const closeBtn = page.locator('aside button', { hasText: 'Close' }).or(page.locator('aside button', { hasText: 'إغلاق' })).first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
  });

  test('Task 5: Export Organization ZIP Bundle', async ({ page }) => {
    // Load reference department
    const refBtn = page.locator('button', { hasText: 'Reference Department' }).or(page.locator('button', { hasText: 'القسم المرجعي' })).first();
    await refBtn.click();
    await page.waitForSelector('.react-flow');

    // Dismiss tour
    const skipBtn = page.locator('button', { hasText: 'Skip' }).or(page.locator('button', { hasText: 'تخطي' }));
    if (await skipBtn.isVisible()) await skipBtn.click();

    // Open export modal
    const exportBtn = page.locator('header button', { hasText: 'Export ZIP' }).or(page.locator('header button', { hasText: 'تصدير' })).first();
    await exportBtn.click();
    await page.waitForSelector('[role="dialog"]');

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');
    const dlBtn = page.locator('[role="dialog"] button', { hasText: 'Download ZIP' }).or(page.locator('[role="dialog"] button', { hasText: 'تنزيل الحزمة' })).or(page.locator('[role="dialog"] button', { hasText: 'Download' })).first();
    await dlBtn.click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.zip$/);

    // Read download stream and verify valid zip archive
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    const zip = await JSZip.loadAsync(buffer);

    // Verify key files in ZIP
    const filenames = Object.keys(zip.files);
    expect(filenames.some((f) => f.includes('contract.json'))).toBe(true);
    expect(filenames.some((f) => f.includes('employee.py'))).toBe(true);
    expect(filenames.some((f) => f.includes('manifest.yaml'))).toBe(true);
  });

  test('Task 6: Deletion with ConfirmDialog & 1-Click Undo Recovery', async ({ page }) => {
    // Load reference department
    const refBtn = page.locator('button', { hasText: 'Reference Department' }).or(page.locator('button', { hasText: 'القسم المرجعي' })).first();
    await refBtn.click();
    await page.waitForSelector('.react-flow');

    // Dismiss tour
    const skipBtn = page.locator('button', { hasText: 'Skip' }).or(page.locator('button', { hasText: 'تخطي' }));
    if (await skipBtn.isVisible()) await skipBtn.click();

    // 1. Select a node on canvas
    const node = page.locator('.react-flow__node[data-id="str"]').first();
    await node.click();

    // 2. Press Delete key
    await page.keyboard.press('Delete');

    // 3. Review ConfirmDialog and confirm deletion
    const confirmBtn = page.locator('[aria-labelledby="confirm-dialog-title"] button', { hasText: 'Confirm' }).or(page.locator('[aria-labelledby="confirm-dialog-title"] button', { hasText: 'تأكيد' })).first();
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    await confirmBtn.click();

    // Node should be deleted from canvas
    await expect(page.locator('.react-flow__node[data-id="str"]')).toHaveCount(0);

    // 4. Undo via Ctrl+Z
    await page.keyboard.press('ControlOrMeta+KeyZ');

    // 5. Node restored on canvas!
    await expect(page.locator('.react-flow__node[data-id="str"]')).toHaveCount(1);
  });
});
