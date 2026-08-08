import { spawnSync } from "node:child_process";

const npmCli = process.env.npm_execpath;
const npmCommand = npmCli ? process.execPath : (process.platform === "win32" ? "npm.cmd" : "npm");
const npmArgs = npmCli ? [npmCli, "--version"] : ["--version"];
const npmNeedsShell = !npmCli && process.platform === "win32";

const checks = [
  { label: "node", command: "node", args: ["--version"] },
  { label: "npm", command: npmCommand, args: npmArgs, shell: npmNeedsShell },
  { label: "rustc", command: "rustc", args: ["--version"] },
  { label: "cargo", command: "cargo", args: ["--version"] },
  { label: "wasm-bindgen", command: "wasm-bindgen", args: ["--version"] },
  { label: "chromium", command: "chromium", args: ["--version"] },
  { label: "gh", command: "gh", args: ["--version"] },
];

const results = checks.map(({ label, command, args, shell = false }) => {
  const run = spawnSync(command, args, { encoding: "utf8", shell });
  return {
    command: label,
    available: run.status === 0,
    version: run.status === 0 ? run.stdout.trim() : null,
    error: run.status === 0 ? null : (run.error?.code ?? run.stderr.trim() ?? `exit ${run.status}`),
  };
});

const capabilities = {
  nodeToolchain: results.slice(0, 2).every((entry) => entry.available),
  rustToolchain: results.slice(2, 5).every((entry) => entry.available),
  browserToolchain: results[5].available,
  githubCli: results[6].available,
};
console.log(JSON.stringify({ schemaVersion: 1, results, capabilities }, null, 2));
if (process.argv.includes("--strict") && !capabilities.nodeToolchain) process.exitCode = 1;
