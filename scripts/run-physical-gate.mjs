import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const resultPath = resolve(process.env.WEBGPU_ZOOMER_RESULT_PATH ?? "test-results/phase-0-browser.json");
const summaryPath = resolve(process.env.WEBGPU_ZOOMER_GATE_SUMMARY_PATH ?? "test-results/phase-0-physical-gate.json");
mkdirSync(dirname(resultPath), { recursive: true });
mkdirSync(dirname(summaryPath), { recursive: true });

const steps = [
  { command: npm, args: ["run", "verify"] },
  { command: "cargo", args: ["run", "--release", "-p", "precision", "--example", "benchmark"] },
  { command: npm, args: ["run", "test:browser"], environment: {
    WEBGPU_ZOOMER_BROWSER_CHANNEL: process.env.WEBGPU_ZOOMER_BROWSER_CHANNEL ?? "chrome",
    WEBGPU_ZOOMER_HEADLESS: "0",
    WEBGPU_ZOOMER_RESULT_PATH: resultPath,
  } },
];

const records = [];
let exitCode = 0;
for (const step of steps) {
  const started = performance.now();
  console.log(`$ ${step.command} ${step.args.join(" ")}`);
  const run = spawnSync(step.command, step.args, {
    cwd: resolve("."),
    env: { ...process.env, ...step.environment },
    stdio: "inherit",
  });
  const status = run.error?.code === "ENOENT" ? 127 : (run.status ?? 1);
  records.push({
    command: `${step.command} ${step.args.join(" ")}`,
    exitCode: status,
    durationMs: Math.round(performance.now() - started),
    error: run.error?.message ?? null,
  });
  if (status !== 0) {
    exitCode = status;
    break;
  }
}

const summary = {
  schemaVersion: 1,
  status: exitCode === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  commands: records,
  browserEvidencePath: resultPath,
  limitation: exitCode === 0 ? null : "No later gate was executed after the first failing command.",
};
writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(`Physical-gate summary: ${summaryPath}`);
if (exitCode !== 0) process.exit(exitCode);
