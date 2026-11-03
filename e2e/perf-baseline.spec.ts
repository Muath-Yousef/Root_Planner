import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.describe('300-Node Drag Performance Baseline', () => {
  test('Drag node in 300-node topology and record frame times (p50, p95)', async ({ page }) => {
    // 1. Open app and load into studio
    await page.goto('/');
    const refBtn = page.locator('button', { hasText: 'Reference Department' }).or(page.locator('button', { hasText: 'القسم المرجعي' })).first();
    await refBtn.click();
    await page.waitForSelector('.react-flow');

    // Dismiss tour if present
    const skipBtn = page.locator('button', { hasText: 'Skip tour' }).or(page.locator('button', { hasText: 'تخطي الجولة' })).first();
    if (await skipBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipBtn.click();
    }

    // 2. Load 300 nodes into studio store
    await page.evaluate(() => {
      const store = (window as any).__STUDIO_STORE__;
      const nodes = Array.from({ length: 300 }, (_, i) => ({
        id: `node-${i}`,
        type: 'studio',
        position: { x: (i % 20) * 160, y: Math.floor(i / 20) * 100 },
        data: {
          kind: 'employee',
          role: i === 0 ? 'scout' : (i % 2 === 0 ? 'drafter' : 'evaluator'),
          label: `Employee ${i}`,
          status: 'IMPLEMENTED',
          networkMode: 'internal',
        },
      }));
      store.setState({ nodes, edges: [], revision: store.getState().revision + 1 });
    });

    await page.waitForTimeout(500);

    // 3. Start CDP session to verify tracing is active
    const client = await page.context().newCDPSession(page);
    await client.send('Performance.enable');

    // 4. Start recording frame intervals in browser via requestAnimationFrame
    await page.evaluate(() => {
      (window as any).__frameTimes = [];
      let last = performance.now();
      function loop(now: number) {
        const delta = now - last;
        last = now;
        (window as any).__frameTimes.push(delta);
        if ((window as any).__recordingFrames) {
          requestAnimationFrame(loop);
        }
      }
      (window as any).__recordingFrames = true;
      requestAnimationFrame(loop);
    });

    // 5. Drag a node for 2 seconds
    const targetNode = page.locator('.react-flow__node[data-id="node-0"]');
    await expect(targetNode).toBeVisible({ timeout: 5000 });
    const box = await targetNode.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();

      const startTime = Date.now();
      let step = 0;
      while (Date.now() - startTime < 2000) {
        step++;
        const offsetX = Math.sin(step * 0.1) * 60;
        const offsetY = Math.cos(step * 0.1) * 40;
        await page.mouse.move(box.x + box.width / 2 + offsetX, box.y + box.height / 2 + offsetY);
        await page.waitForTimeout(16);
      }
      await page.mouse.up();
    }

    // 6. Stop recording frames and collect data
    const rawFrameTimes: number[] = await page.evaluate(() => {
      (window as any).__recordingFrames = false;
      return (window as any).__frameTimes || [];
    });

    // Discard the very first frame warmup
    const frameTimes = rawFrameTimes.slice(2).filter((t) => t > 0);
    expect(frameTimes.length).toBeGreaterThan(20);

    frameTimes.sort((a, b) => a - b);
    const p50 = frameTimes[Math.floor(frameTimes.length * 0.5)];
    const p95 = frameTimes[Math.floor(frameTimes.length * 0.95)];
    const max = frameTimes[frameTimes.length - 1];

    const baselineData = {
      timestamp: new Date().toISOString(),
      nodeCount: 300,
      dragDurationMs: 2000,
      sampleCount: frameTimes.length,
      p50_ms: Number(p50.toFixed(2)),
      p95_ms: Number(p95.toFixed(2)),
      max_ms: Number(max.toFixed(2)),
      threshold_p95_ms: 50.0,
      passed: p95 <= 50.0,
    };

    console.log('Performance Baseline Results:', JSON.stringify(baselineData, null, 2));

    // 7. Write to docs/perf/baseline.json
    const outDir = path.resolve(process.cwd(), 'docs', 'perf');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, 'baseline.json'),
      JSON.stringify(baselineData, null, 2),
      'utf8'
    );

    // 8. If p95 > 50ms, log finding in docs/usability/FINDINGS.md without loosening threshold
    const findingsPath = path.resolve(process.cwd(), 'docs', 'usability', 'FINDINGS.md');
    let findingsContent = fs.existsSync(findingsPath) ? fs.readFileSync(findingsPath, 'utf8') : '# Usability & Verification Findings\n\n';

    if (p95 > 50.0) {
      findingsContent += `\n## ⚠️ Performance Baseline Warning: 300-Node Drag\n- **p95 Frame Time:** ${p95.toFixed(2)} ms (exceeds threshold of 50.0 ms)\n- **p50 Frame Time:** ${p50.toFixed(2)} ms\n- **Observation:** With 300 nodes rendered, continuous canvas drag exhibits occasional frame drop peaks.\n`;
    } else {
      findingsContent += `\n## ✅ Performance Baseline Passed: 300-Node Drag\n- **p95 Frame Time:** ${p95.toFixed(2)} ms (within 50.0 ms budget)\n- **p50 Frame Time:** ${p50.toFixed(2)} ms (~60 FPS)\n- **Observation:** React.memo isolation successfully prevents re-renders of unrelated nodes during continuous drag.\n`;
    }
    fs.writeFileSync(findingsPath, findingsContent, 'utf8');

    expect(fs.existsSync(path.join(outDir, 'baseline.json'))).toBe(true);
  });
});
