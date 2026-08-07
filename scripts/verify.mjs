import { spawnSync } from "node:child_process";

const steps = [
  ["node", ["scripts/validate-fixtures.mjs"]],
  ["npm", ["run", "typecheck"]],
  ["npm", ["run", "test"]],
  ["cargo", ["fmt", "--all", "--", "--check"]],
  ["cargo", ["test", "--workspace"]],
  ["npm", ["run", "build:wasm"]],
  ["npm", ["run", "build"]],
];
for (const [command, args] of steps) {
  console.log(`$ ${command} ${args.join(" ")}`);
  const run = spawnSync(command, args, { stdio: "inherit" });
  if (run.error?.code === "ENOENT") {
    console.error(`Required command unavailable: ${command}`);
    process.exit(127);
  }
  if (run.status !== 0) process.exit(run.status ?? 1);
}
