import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const path = resolve("apps/web/public/fixtures/oracle-corpus-v1.json");
const corpus = JSON.parse(readFileSync(path, "utf8"));
const requiredCategories = ["shallow", "boundary", "deep", "insufficient-precision", "negative-world-coordinate", "extreme-exponent"];
const ids = new Set();
const errors = [];

if (corpus.schemaVersion !== 1) errors.push("schemaVersion must be 1");
if (corpus.legacyExpectedResultsImported !== false) errors.push("legacy expected results must not be imported");
for (const category of requiredCategories) {
  if (!corpus.cases.some((entry) => entry.category === category)) errors.push(`missing category: ${category}`);
}
for (const entry of corpus.cases) {
  if (ids.has(entry.id)) errors.push(`duplicate fixture id: ${entry.id}`);
  ids.add(entry.id);
  if (!entry.expected || !["escaped", "certified_interior", "unresolved", "invalid"].includes(entry.expected.status)) {
    errors.push(`invalid expected provenance: ${entry.id}`);
  }
  if (entry.expected.reason === "iteration_budget_exhausted" && entry.expected.status !== "unresolved") {
    errors.push(`cap exhaustion promoted: ${entry.id}`);
  }
}
if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(JSON.stringify({ schemaVersion: 1, fixtureCount: corpus.cases.length, categories: requiredCategories }, null, 2));
