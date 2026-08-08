import { spawnSync } from "node:child_process";

const npmCli = process.env.npm_execpath;
const npmCommand = npmCli ? process.execPath : (process.platform === "win32" ? "npm.cmd" : "npm");
const npmArgs = (args) => npmCli ? [npmCli, ...args] : args;
const npmNeedsShell = !npmCli && process.platform === "win32";

const steps = [
  { label: "node scripts/validate-fixtures.mjs", command: "node", args: ["scripts/validate-fixtures.mjs"] },
  { label: "npm run typecheck", command: npmCommand, args: npmArgs(["run", "typecheck"]), shell: npmNeedsShell },
  { label: "npm run test", command: npmCommand, args: npmArgs(["run", "test"]), shell: npmNeedsShell },
  { label: "cargo fmt --all -- --check", command: "cargo", args: ["fmt", "--all", "--", "--check"] },
  { label: "cargo test --workspace", command: "cargo", args: ["test", "--workspace"] },
  { label: "npm run build:wasm", command: npmCommand, args: npmArgs(["run", "build:wasm"]), shell: npmNeedsShell },
  { label: "npm run build", command: npmCommand, args: npmArgs(["run", "build"]), shell: npmNeedsShell },
];
for (const { label, command, args, shell = false } of steps) {
  console.log(`$ ${label}`);
  const run = spawnSync(command, args, { stdio: "inherit", shell });
  if (run.error?.code === "ENOENT") {
    console.error(`Required command unavailable: ${command}`);
    process.exit(127);
  }
  if (run.status !== 0) process.exit(run.status ?? 1);
}
