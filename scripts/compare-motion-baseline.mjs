#!/usr/bin/env node
// Compares a motion-metrics JSONL run (MOTION_METRICS_PATH output) against
// the committed golden baseline. Static budgets catch breakage; this
// catches CREEP — a metric drifting within budget across many commits.
//
//   node scripts/compare-motion-baseline.mjs <run.jsonl> [--update]
//
// --update rewrites e2e/motion-baseline.json from the run (use after an
// intentional motion change, and commit the result with it).

import { readFileSync, writeFileSync } from "node:fs";

const BASELINE_PATH = "e2e/motion-baseline.json";
// Drift tolerances above observed run-to-run noise; anything beyond these
// is a real change some commit made and should be owned by that commit.
const TOLERANCE = {
  settle: 8,
  corridor: 12,
  excursion: 12,
  settleX: 15,
  corridorX: 15,
};

const [runPath, flag] = process.argv.slice(2);
if (!runPath) {
  console.error(
    "usage: compare-motion-baseline.mjs <run.jsonl> [--update]",
  );
  process.exit(2);
}

const run = new Map();
for (const line of readFileSync(runPath, "utf8").split("\n")) {
  if (!line.trim()) continue;
  const { key, ...values } = JSON.parse(line);
  run.set(key, values);
}

if (flag === "--update") {
  const sorted = Object.fromEntries(
    [...run.entries()].sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(BASELINE_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`baseline updated: ${run.size} metrics -> ${BASELINE_PATH}`);
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
} catch {
  console.error(
    `no baseline at ${BASELINE_PATH} — run with --update to create it`,
  );
  process.exit(2);
}

const drifted = [];
const missing = [];
const added = [];
for (const [key, values] of Object.entries(baseline)) {
  const current = run.get(key);
  if (!current) {
    missing.push(key);
    continue;
  }
  for (const [metric, tolerance] of Object.entries(TOLERANCE)) {
    if (!(metric in values) || !(metric in current)) continue;
    const delta = Math.abs(current[metric] - values[metric]);
    if (delta > tolerance) {
      drifted.push(
        `${key} ${metric}: ${values[metric].toFixed(1)} -> ${current[metric].toFixed(1)} (drift ${delta.toFixed(1)} > ${tolerance})`,
      );
    }
  }
}
for (const key of run.keys()) {
  if (!(key in baseline)) added.push(key);
}

if (added.length) {
  console.log(`note: ${added.length} new metrics not in baseline (run --update to adopt):`);
  for (const key of added.slice(0, 10)) console.log(`  + ${key}`);
}
if (missing.length) {
  console.log(`warning: ${missing.length} baseline metrics absent from this run:`);
  for (const key of missing.slice(0, 10)) console.log(`  - ${key}`);
}
if (drifted.length) {
  console.error(`MOTION DRIFT — ${drifted.length} metrics moved beyond tolerance:`);
  for (const line of drifted) console.error(`  ${line}`);
  console.error(
    "If this motion change is intentional, regenerate the baseline (compare-motion-baseline.mjs <run> --update) and commit it with the change.",
  );
  process.exit(1);
}
console.log(`motion baseline clean: ${run.size} metrics within tolerance`);
