#!/usr/bin/env node
/**
 * scripts/usability-summary.mjs
 * Aggregates empirical human usability data from docs/usability/raw/*.md files.
 * Calculates task success rate, median completion time, and composite SUS score.
 */

import fs from "node:fs";
import path from "node:path";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const RAW_DIR = path.join(REPO_ROOT, "docs", "usability", "raw");

if (!fs.existsSync(RAW_DIR)) {
  console.log("No docs/usability/raw directory found.");
  process.exit(0);
}

const rawFiles = fs.readdirSync(RAW_DIR).filter(f => f.endsWith(".md") && !f.startsWith("_"));

if (rawFiles.length === 0) {
  console.log("ℹ️  No completed participant session files found in docs/usability/raw/.");
  console.log("   (Raw template is available at docs/usability/raw/_template.md)");
  process.exit(0);
}

console.log(`📊 Processing ${rawFiles.length} participant session file(s)...`);

let totalTasks = 0;
let successfulTasks = 0;
const timesByTask = {};
const susScores = [];

function calculateSUS(scores) {
  if (scores.length !== 10) return null;
  // Odd questions (1, 3, 5, 7, 9): score - 1
  // Even questions (2, 4, 6, 8, 10): 5 - score
  let total = 0;
  for (let i = 0; i < 10; i++) {
    const val = scores[i];
    if (i % 2 === 0) {
      total += (val - 1);
    } else {
      total += (5 - val);
    }
  }
  return total * 2.5; // Standard SUS multiplier (scale 0-100)
}

for (const file of rawFiles) {
  const content = fs.readFileSync(path.join(RAW_DIR, file), "utf8");
  
  // Extract task statuses and times
  const taskRegex = /### Task (\d+):[^\n]*\n- \*\*Status:\*\* \[(SUCCESS|FAILED|ASSISTED)\]\n- \*\*Time on Task \(seconds\):\*\* (\d+)/g;
  let match;
  while ((match = taskRegex.exec(content)) !== null) {
    const taskNum = match[1];
    const status = match[2];
    const time = parseInt(match[3], 10);

    totalTasks++;
    if (status === "SUCCESS") successfulTasks++;

    if (!timesByTask[taskNum]) timesByTask[taskNum] = [];
    timesByTask[taskNum].push(time);
  }

  // Extract SUS scores array: Raw Scores Array: `[4, 2, ...]`
  const susMatch = content.match(/Raw Scores Array:\s*`\[([0-9,\s]+)\]`/);
  if (susMatch) {
    const numbers = susMatch[1].split(",").map(n => parseInt(n.trim(), 10));
    const sus = calculateSUS(numbers);
    if (sus !== null) susScores.push(sus);
  }
}

function median(arr) {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

console.log("\n=======================================================");
console.log("             USABILITY STUDY SUMMARY REPORT            ");
console.log("=======================================================");
console.log(`Participants Evaluated:    ${rawFiles.length}`);
console.log(`Overall Task Success Rate: ${totalTasks > 0 ? ((successfulTasks / totalTasks) * 100).toFixed(1) : 0}% (${successfulTasks}/${totalTasks})`);

console.log("\nMedian Times by Task (seconds):");
for (const [taskNum, times] of Object.entries(timesByTask)) {
  console.log(`  - Task ${taskNum}: ${median(times)}s (samples: ${times.length})`);
}

if (susScores.length > 0) {
  const avgSus = (susScores.reduce((a, b) => a + b, 0) / susScores.length).toFixed(1);
  console.log(`\nSystem Usability Scale (SUS) Score: ${avgSus} / 100 (Industry benchmark: 68.0)`);
} else {
  console.log("\nSystem Usability Scale (SUS): No complete questionnaire arrays found.");
}
console.log("=======================================================\n");
