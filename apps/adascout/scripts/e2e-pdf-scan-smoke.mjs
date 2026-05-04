#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const argv = process.argv.slice(2).filter((arg) => arg !== "--");
const fixtureArg = argv[0] ?? "scripts/pdf-fixtures.example.json";
const fixturePath = resolve(process.cwd(), fixtureArg);

const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const fixtures = Array.isArray(fixture?.fixtures)
  ? fixture.fixtures
  : Array.isArray(fixture?.urls)
    ? fixture.urls.map((url) => ({ url }))
    : [];

if (fixtures.length === 0) {
  console.error(
    `[pdf-smoke] No fixtures found in ${fixturePath}. Add "fixtures" (or legacy "urls") with at least one PDF.`,
  );
  process.exit(1);
}

let failed = 0;
for (const fixtureRow of fixtures) {
  const fileUrl = String(fixtureRow?.url ?? "").trim();
  if (!fileUrl) {
    console.error("[pdf-smoke] Fixture row is missing a valid url.");
    failed += 1;
    continue;
  }
  const expectedRules = Array.isArray(fixtureRow?.expectedRules)
    ? fixtureRow.expectedRules.map((row) => String(row))
    : [];
  const forbiddenRules = Array.isArray(fixtureRow?.forbiddenRules)
    ? fixtureRow.forbiddenRules.map((row) => String(row))
    : [];

  const payload = JSON.stringify({ fileUrl });
  const result = spawnSync(
    "npx",
    ["convex", "run", "scanRunner:e2ePdfScanSmoke", payload],
    {
      stdio: "pipe",
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    const stderr = result.stderr ? String(result.stderr) : "";
    if (stderr) process.stderr.write(stderr);
    const stdout = result.stdout ? String(result.stdout) : "";
    if (stdout) process.stdout.write(stdout);
    failed += 1;
    continue;
  }

  const stdout = String(result.stdout ?? "").trim();
  if (!stdout) {
    console.error(`[pdf-smoke] No output returned for ${fileUrl}`);
    failed += 1;
    continue;
  }

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (_error) {
    console.error(`[pdf-smoke] Failed to parse JSON output for ${fileUrl}`);
    process.stdout.write(stdout);
    failed += 1;
    continue;
  }

  const rules = new Set(
    Array.isArray(parsed?.rules)
      ? parsed.rules
          .map((row) => (row && typeof row.ruleId === "string" ? row.ruleId : ""))
          .filter((row) => row.length > 0)
      : [],
  );

  const missingExpected = expectedRules.filter((ruleId) => !rules.has(ruleId));
  const presentForbidden = forbiddenRules.filter((ruleId) => rules.has(ruleId));

  if (missingExpected.length > 0 || presentForbidden.length > 0) {
    console.error(`[pdf-smoke] Rule assertion failed for ${fileUrl}`);
    if (missingExpected.length > 0) {
      console.error(
        `[pdf-smoke] Missing expected rules: ${missingExpected.join(", ")}`,
      );
    }
    if (presentForbidden.length > 0) {
      console.error(
        `[pdf-smoke] Found forbidden rules: ${presentForbidden.join(", ")}`,
      );
    }
    failed += 1;
    continue;
  }

  process.stdout.write(`${stdout}\n`);
  if (expectedRules.length > 0 || forbiddenRules.length > 0) {
    console.log(
      `[pdf-smoke] Assertions passed for ${fileUrl} (expected=${expectedRules.length}, forbidden=${forbiddenRules.length}).`,
    );
  }
}

if (failed > 0) {
  console.error(`[pdf-smoke] ${failed} fixture run(s) failed.`);
  process.exit(1);
}

console.log(`[pdf-smoke] Completed ${fixtures.length} fixture run(s) successfully.`);
