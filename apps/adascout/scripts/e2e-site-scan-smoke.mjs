#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const defaultUrl = "https://abatefloridainc.com/";
const argv = process.argv.slice(2).filter((arg) => arg !== "--");
const url = argv[0] ?? defaultUrl;
const parsedMaxPages = Number(argv[1] ?? 100);
const parsedSamplePages = Number(argv[2] ?? 5);
const maxPages = Number.isFinite(parsedMaxPages) ? parsedMaxPages : 100;
const samplePages = Number.isFinite(parsedSamplePages) ? parsedSamplePages : 5;

const payload = JSON.stringify({
  url,
  maxPages,
  samplePages,
});

const command = "npx";
const args = ["convex", "run", "scanRunner:e2eWebsiteScanSmoke", payload];

const result = spawnSync(command, args, {
  stdio: "inherit",
  cwd: process.cwd(),
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
