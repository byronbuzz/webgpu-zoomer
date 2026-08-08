import { resolve } from "node:path";
import { createZip } from "./archive-tools.mjs";
import { validateEvidenceTarget } from "./validate-evidence.mjs";

const bundle = resolve(process.argv[2] ?? "");
const output = resolve(process.argv[3] ?? `${bundle}.zip`);
validateEvidenceTarget(bundle);
createZip(bundle, output);
validateEvidenceTarget(output);
console.log(output);
