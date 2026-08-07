import { spawnSync } from "node:child_process";
import { basename, dirname, resolve } from "node:path";
import { validateEvidenceTarget } from "./validate-evidence.mjs";

const bundle = resolve(process.argv[2] ?? "");
const output = resolve(process.argv[3] ?? `${bundle}.zip`);
validateEvidenceTarget(bundle);
const run = spawnSync("zip", ["-qr", output, basename(bundle)], { cwd: dirname(bundle), stdio: "inherit" });
if (run.status !== 0) process.exit(run.status ?? 1);
validateEvidenceTarget(output);
console.log(output);
