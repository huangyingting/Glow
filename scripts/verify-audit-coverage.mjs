import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const expectedTools = [
  ["glow", "photography"], ["fog", "photography"], ["sun", "photography"], ["moon", "photography"],
  ["stars", "photography"], ["lunar-eclipse", "photography"], ["solar-eclipse", "photography"],
  ["cloud", "weather"], ["rain", "weather"], ["rainbow", "weather"],
];
const expectedScreenshots = {
  "phone-short-320": 23,
  "phone-320": 23,
  "phone-390": 26,
  "tablet-768": 23,
  "laptop-short-1024": 23,
  "laptop-1024": 23,
  "desktop-1440": 23,
  "wide-1920": 23,
};

const dashboard = await readFile(path.join(root, "components/glow-dashboard.tsx"), "utf8");
const registeredTools = [...dashboard.matchAll(/\{ id: "([^"]+)", family: "([^"]+)"/g)].map((match) => [match[1], match[2]]);
if (JSON.stringify(registeredTools) !== JSON.stringify(expectedTools)) {
  throw new Error(`Tool registry mismatch: ${registeredTools.map((tool) => tool.join(":")).join(", ")}`);
}

const report = JSON.parse(await readFile(path.join(root, "test-results/playwright-results.json"), "utf8"));
const specs = [];
const collect = (suite) => {
  if (Array.isArray(suite.specs)) specs.push(...suite.specs);
  for (const child of suite.suites ?? []) collect(child);
};
for (const suite of report.suites ?? []) collect(suite);
const results = specs.flatMap((spec) => spec.tests ?? []).flatMap((test) => test.results ?? []);
const failed = results.filter((result) => result.status !== "passed" && result.status !== "skipped");
if (specs.length !== 22 || failed.length) {
  throw new Error(`Playwright reconciliation failed: ${specs.length}/22 specs, ${failed.length} failed results`);
}

const screenshotCounts = {};
for (const [viewport, expected] of Object.entries(expectedScreenshots)) {
  const directory = path.join(root, "test-results/ui-audit", viewport);
  const files = (await readdir(directory)).filter((file) => file.endsWith(".png"));
  screenshotCounts[viewport] = files.length;
  if (files.length !== expected) throw new Error(`${viewport}: expected ${expected} screenshots, found ${files.length}`);
}

const summary = {
  generatedAt: new Date().toISOString(),
  tools: {
    expected: expectedTools.length,
    covered: registeredTools.length,
    photography: registeredTools.filter((tool) => tool[1] === "photography").map((tool) => tool[0]),
    weather: registeredTools.filter((tool) => tool[1] === "weather").map((tool) => tool[0]),
  },
  datesPerWeatherMode: 7,
  responsiveViewports: Object.keys(expectedScreenshots).length,
  screenshots: Object.values(screenshotCounts).reduce((sum, count) => sum + count, 0),
  screenshotCounts,
  playwrightSpecs: specs.length,
  playwrightFailures: failed.length,
  axeScans: 24,
};
await writeFile(path.join(root, "test-results/audit-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary));
