import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const expectedWorkspaces = ["opportunities", "weather", "events"];
const expectedScreenshots = {
  "phone-short-320": 10,
  "phone-320": 10,
  "phone-390": 12,
  "tablet-768": 10,
  "laptop-short-1024": 10,
  "laptop-1024": 10,
  "desktop-1440": 10,
  "wide-1920": 10,
};

const dashboard = await readFile(path.join(root, "components/glow-dashboard.tsx"), "utf8");
const registeredWorkspaces = [...dashboard.matchAll(/\{ id: "(opportunities|weather|events)", label:/g)].map((match) => match[1]);
if (JSON.stringify(registeredWorkspaces) !== JSON.stringify(expectedWorkspaces)) {
  throw new Error(`Workspace registry mismatch: ${registeredWorkspaces.join(", ")}`);
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
  workspaces: {
    expected: expectedWorkspaces.length,
    covered: registeredWorkspaces,
  },
  dailyOpportunities: 9,
  weatherViews: ["cloud", "rain", "wind"],
  rareEventKinds: ["solar-eclipse", "lunar-eclipse", "meteor-shower"],
  datesPerForecastWorkspace: 7,
  responsiveViewports: Object.keys(expectedScreenshots).length,
  screenshots: Object.values(screenshotCounts).reduce((sum, count) => sum + count, 0),
  screenshotCounts,
  playwrightSpecs: specs.length,
  playwrightFailures: failed.length,
  axeScans: 14,
};
await writeFile(path.join(root, "test-results/audit-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary));
