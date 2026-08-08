import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const npmCli = process.env.npm_execpath;
const npmCommand = npmCli ? process.execPath : (process.platform === "win32" ? "npm.cmd" : "npm");
const npmArgs = npmCli ? [npmCli, "ci"] : ["ci"];
const npmNeedsShell = !npmCli && process.platform === "win32";

const steps = [
  { command: process.execPath, args: [fileURLToPath(new URL("./doctor.mjs", import.meta.url)), "--strict"] },
  { command: npmCommand, args: npmArgs, shell: npmNeedsShell },
];
for (const { command, args, shell = false } of steps) {
  const run = spawnSync(command, args, { stdio: "inherit", shell });
  if (run.status !== 0) process.exit(run.status ?? 1);
}
console.log("Base setup complete. Run `npm run build:wasm` before the browser harness.");
