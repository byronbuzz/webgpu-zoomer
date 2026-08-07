import { spawnSync } from "node:child_process";

const checks = [
  ["node", ["--version"]],
  ["npm", ["--version"]],
  ["rustc", ["--version"]],
  ["cargo", ["--version"]],
  ["wasm-bindgen", ["--version"]],
  ["chromium", ["--version"]],
  ["gh", ["--version"]],
];

const results = checks.map(([command, args]) => {
  const run = spawnSync(command, args, { encoding: "utf8" });
  return {
    command,
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
