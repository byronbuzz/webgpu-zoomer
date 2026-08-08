import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const output = resolve(root, "apps/web/src/generated/wasm");
mkdirSync(output, { recursive: true });

const steps = [
  ["cargo", ["build", "--release", "--target", "wasm32-unknown-unknown", "-p", "precision-wasm"]],
  ["wasm-bindgen", [
    "--target", "web",
    "--out-dir", output,
    "--out-name", "precision_wasm",
    resolve(root, "target/wasm32-unknown-unknown/release/precision_wasm.wasm"),
  ]],
];
for (const [command, args] of steps) {
  const run = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (run.error?.code === "ENOENT") {
    console.error(`${command} is required but unavailable. Run npm run doctor for the complete manifest.`);
    process.exit(127);
  }
  if (run.status !== 0) process.exit(run.status ?? 1);
}
