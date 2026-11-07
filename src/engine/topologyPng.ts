import * as fs from 'node:fs';
import { chromium } from 'playwright-core';

/**
 * Phase 5 — SVG → PNG via the headless Chromium that Playwright already
 * brings as a devDependency (`@playwright/test`). No new dependency: the
 * browser binary is installed once with `npx playwright install chromium`
 * (see `docs/EXPORT_REVIEW.md`). If the binary is missing, the error says
 * so and names that exact command instead of failing obscurely.
 */

export interface PngResult { outPath: string; width: number; height: number }

const sizeOf = (svg: string): { width: number; height: number } => {
  const w = svg.match(/<svg[^>]*\swidth="(\d+)"/)?.[1];
  const h = svg.match(/<svg[^>]*\sheight="(\d+)"/)?.[1];
  if (w === undefined || h === undefined) throw new Error('الـ SVG المولَّدة بلا أبعاد width/height — لا يمكن تحويلها إلى PNG');
  return { width: Number(w), height: Number(h) };
};

/** Rasterises an SVG string (as produced by `renderTopologySvg`) to a PNG file. */
export async function renderTopologyPng(svg: string, outPath: string): Promise<PngResult> {
  const { width, height } = sizeOf(svg);
  let browser;
  try {
    browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  } catch {
    throw new Error('تعذّر تشغيل Chromium لتحويل SVG إلى PNG — ثبّت المتصفح أولاً: npx playwright install chromium');
  }
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#0b1220}svg{display:block}</style></head><body>${svg}</body></html>`,
    );
    await page.locator('svg').screenshot({ path: outPath });
    return { outPath, width, height };
  } finally {
    await browser.close();
  }
}

/** Reads PNG width/height from the IHDR chunk (no image library needed). */
export function pngSize(p: string): { width: number; height: number } {
  const buf = fs.readFileSync(p);
  if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG') throw new Error(`${p}: ليس ملف PNG صالحاً`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}
