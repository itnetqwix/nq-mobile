#!/usr/bin/env node
/**
 * Lightweight Maestro flow validation for CI (no device / app required).
 * Ensures flow files exist and declare required env keys.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const flowsDir = path.join(root, "e2e", "maestro");
const requiredEnv = ["APP_ID", "TRAINEE_EMAIL", "TRAINEE_PASSWORD"];

const files = fs.readdirSync(flowsDir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

if (files.length === 0) {
  console.error("No Maestro flow files found in e2e/maestro/");
  process.exit(1);
}

let failed = 0;

for (const file of files) {
  const text = fs.readFileSync(path.join(flowsDir, file), "utf8");
  if (!text.includes("appId:")) {
    console.error(`[FAIL] ${file}: missing appId`);
    failed += 1;
    continue;
  }
  for (const key of requiredEnv) {
    if (!text.includes(`${key}:`) && !text.includes(`\${${key}}`)) {
      console.error(`[FAIL] ${file}: missing env reference ${key}`);
      failed += 1;
    }
  }
  if (!text.includes("---")) {
    console.error(`[FAIL] ${file}: missing YAML document separator ---`);
    failed += 1;
    continue;
  }
  console.log(`[OK] ${file}`);
}

const examplePath = path.join(flowsDir, ".env.example");
if (!fs.existsSync(examplePath)) {
  console.error("[FAIL] e2e/maestro/.env.example is missing");
  failed += 1;
} else {
  const example = fs.readFileSync(examplePath, "utf8");
  for (const key of requiredEnv) {
    if (!example.includes(key)) {
      console.error(`[FAIL] .env.example missing ${key}`);
      failed += 1;
    }
  }
}

if (failed > 0) {
  console.error(`\n${failed} validation error(s)\n`);
  process.exit(1);
}

console.log(`\nValidated ${files.length} Maestro flow(s).\n`);
