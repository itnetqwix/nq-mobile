#!/usr/bin/env node
/**
 * Payment flow coverage runner — maps to docs/PAYMENT_FLOW_COVERAGE.md
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CASES = [
  { label: "Phase 4 payment helpers", cmd: ["npm", "run", "test:phase4"] },
  { label: "Maestro flow structure", cmd: ["npm", "run", "test:e2e:validate"] },
  { label: "Wizard + pricing + currency", cmd: ["npm", "run", "test:payment-flow:unit"] },
];

console.log("\n=== Payment Flow Coverage (mobile) ===\n");

let passed = 0;
let failed = 0;

for (const c of CASES) {
  const r = spawnSync(c.cmd[0], c.cmd.slice(1), { cwd: root, encoding: "utf8", shell: true });
  const ok = r.status === 0;
  if (ok) passed += 1;
  else failed += 1;
  console.log(`[${ok ? "PASS" : "FAIL"}] ${c.label}`);
  if (!ok) console.log(`${r.stdout || ""}${r.stderr || ""}`.split("\n").slice(-6).join("\n"));
}

console.log(`\n${passed} passed, ${failed} failed (${CASES.length} suites)\n`);
process.exit(failed > 0 ? 1 : 0);
