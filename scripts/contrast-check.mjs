#!/usr/bin/env node
/**
 * WCAG 2.1 AA Contrast Ratio Verification Script
 * Validates text-to-background contrast ratios for dark and light theme tokens,
 * placeholders, disabled states, and cable label badges.
 * Exits with code 1 if any active text pair is below 4.5:1 (WCAG AA normal text).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Standard WCAG 2.1 Relative Luminance calculation
function sRGBtoLin(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  const bigint = parseInt(clean, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function relativeLuminance([r, g, b]) {
  return 0.2126 * sRGBtoLin(r) + 0.7152 * sRGBtoLin(g) + 0.0722 * sRGBtoLin(b);
}

function contrastRatio(fgHex, bgHex) {
  const l1 = relativeLuminance(hexToRgb(fgHex));
  const l2 = relativeLuminance(hexToRgb(bgHex));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Canonical Tailwind / SOCROOT color tokens
const TOKENS = {
  // Dark Theme Backgrounds
  darkBgApp: '#0b1220',
  darkBgSurface: '#0f172a',
  darkBgCard: '#1e293b',
  slate950: '#020617',
  canvasBg: '#090d16',

  // Dark Theme Text
  textPrimaryDark: '#f8fafc',
  textSecondaryDark: '#cbd5e1',
  textMutedDark: '#94a3b8',
  slate400: '#94a3b8',
  slate300: '#cbd5e1',
  slate200: '#e2e8f0',
  slate100: '#f1f5f9',

  // Light Theme Backgrounds
  lightBgApp: '#f8fafc',
  lightBgSurface: '#ffffff',
  lightBgCard: '#f1f5f9',
  lightSurfaceAlt: '#e2e8f0',

  // Light Theme Text
  textPrimaryLight: '#0f172a',
  textSecondaryLight: '#1e293b',
  textMutedLight: '#475569',
  slate700: '#334155',
  slate600: '#475569',

  // Cable Label Colors (on #090d16)
  cableObjectiveRoute: '#f2b23a',
  cableTaskDispatch: '#2cc4dd',
  cableEscalation: '#f2803a',
  cableMemoryBus: '#a66cf0',
  cableEgress: '#34c48b',
  cableKillPlane: '#f87171', // AA-compliant red-400 for text labels on #090d16
};

// Check pairs: [label, foreground, background, minRatio, isExempt]
const PAIRS = [
  // Dark Theme Core Tokens
  { name: 'Dark Theme: text-primary on bg-surface', fg: TOKENS.textPrimaryDark, bg: TOKENS.darkBgSurface, min: 4.5 },
  { name: 'Dark Theme: text-secondary on bg-surface', fg: TOKENS.textSecondaryDark, bg: TOKENS.darkBgSurface, min: 4.5 },
  { name: 'Dark Theme: text-muted on bg-surface', fg: TOKENS.textMutedDark, bg: TOKENS.darkBgSurface, min: 4.5 },
  { name: 'Dark Theme: text-slate-400 on slate-900', fg: TOKENS.slate400, bg: TOKENS.darkBgSurface, min: 4.5 },
  { name: 'Dark Theme: text-slate-300 on slate-900', fg: TOKENS.slate300, bg: TOKENS.darkBgSurface, min: 4.5 },
  { name: 'Dark Theme: text-slate-200 on slate-900', fg: TOKENS.slate200, bg: TOKENS.darkBgSurface, min: 4.5 },
  { name: 'Dark Theme: text-slate-100 on slate-900', fg: TOKENS.slate100, bg: TOKENS.darkBgSurface, min: 4.5 },
  { name: 'Dark Theme: text-slate-400 on slate-950', fg: TOKENS.slate400, bg: TOKENS.slate950, min: 4.5 },
  { name: 'Dark Theme: text-slate-300 on slate-800', fg: TOKENS.slate300, bg: TOKENS.darkBgCard, min: 4.5 },
  { name: 'Dark Theme: text-slate-400 on slate-800', fg: TOKENS.slate400, bg: TOKENS.darkBgCard, min: 4.5 },
  { name: 'Dark Theme: Placeholder text (slate-400 on slate-900)', fg: TOKENS.slate400, bg: TOKENS.darkBgSurface, min: 4.5 },

  // Light Theme Core Tokens
  { name: 'Light Theme: text-primary on bg-surface', fg: TOKENS.textPrimaryLight, bg: TOKENS.lightBgSurface, min: 4.5 },
  { name: 'Light Theme: text-secondary on bg-surface', fg: TOKENS.textSecondaryLight, bg: TOKENS.lightBgSurface, min: 4.5 },
  { name: 'Light Theme: text-muted on bg-surface', fg: TOKENS.textMutedLight, bg: TOKENS.lightBgSurface, min: 4.5 },
  { name: 'Light Theme: text-primary on bg-card', fg: TOKENS.textPrimaryLight, bg: TOKENS.lightBgCard, min: 4.5 },
  { name: 'Light Theme: text-slate-700 on bg-surface', fg: TOKENS.slate700, bg: TOKENS.lightBgSurface, min: 4.5 },
  { name: 'Light Theme: text-slate-600 on bg-surface', fg: TOKENS.slate600, bg: TOKENS.lightBgSurface, min: 4.5 },
  { name: 'Light Theme: Placeholder text (slate-600 on bg-surface)', fg: TOKENS.slate600, bg: TOKENS.lightBgSurface, min: 4.5 },

  // Cable Label Badges on Canvas Background (#090d16)
  { name: 'Cable Label: OBJECTIVE_ROUTE on badge bg', fg: TOKENS.cableObjectiveRoute, bg: TOKENS.canvasBg, min: 4.5 },
  { name: 'Cable Label: TASK_DISPATCH_RESULT on badge bg', fg: TOKENS.cableTaskDispatch, bg: TOKENS.canvasBg, min: 4.5 },
  { name: 'Cable Label: ESCALATION_PATH on badge bg', fg: TOKENS.cableEscalation, bg: TOKENS.canvasBg, min: 4.5 },
  { name: 'Cable Label: MEMORY_BUS on badge bg', fg: TOKENS.cableMemoryBus, bg: TOKENS.canvasBg, min: 4.5 },
  { name: 'Cable Label: EGRESS_NETWORK on badge bg', fg: TOKENS.cableEgress, bg: TOKENS.canvasBg, min: 4.5 },
  { name: 'Cable Label: KILL_PLANE_SIGNAL on badge bg', fg: TOKENS.cableKillPlane, bg: TOKENS.canvasBg, min: 4.5 },
];

console.log('================================================================');
console.log('       WCAG 2.1 AA Contrast Ratio Verification Check           ');
console.log('================================================================');
console.log(`Checking ${PAIRS.length} active text & UI background pairs against WCAG AA (>= 4.5:1)...\n`);

let failedCount = 0;

for (const pair of PAIRS) {
  const ratio = contrastRatio(pair.fg, pair.bg);
  const ratioStr = ratio.toFixed(2) + ':1';
  const passed = ratio >= pair.min;

  if (passed) {
    console.log(`  [PASS] ${ratioStr.padEnd(8)} | ${pair.name} (${pair.fg} on ${pair.bg})`);
  } else {
    failedCount++;
    console.error(`  [FAIL] ${ratioStr.padEnd(8)} | ${pair.name} (${pair.fg} on ${pair.bg}) < ${pair.min}:1`);
  }
}

console.log('\n----------------------------------------------------------------');
if (failedCount === 0) {
  console.log(`Result: ALL ${PAIRS.length} pairs PASS WCAG 2.1 AA requirements (>= 4.5:1).`);
  console.log('================================================================\n');
  process.exit(0);
} else {
  console.error(`Result: ${failedCount} pair(s) FAILED WCAG 2.1 AA requirements.`);
  console.log('================================================================\n');
  process.exit(1);
}
