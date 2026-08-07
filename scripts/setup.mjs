import { spawnSync } from "node:child_process";

const steps = [
  [process.execPath, [new URL("./doctor.mjs", import.meta.url).pathname, "--strict"]],
  ["npm", ["ci"]],
];
for (const [command, args] of steps) {
  const run = spawnSync(command, args, { stdio: "inherit" });
  if (run.status !== 0) process.exit(run.status ?? 1);
}
console.log("Base setup complete. Run `npm run build:wasm` before the browser harness.");
