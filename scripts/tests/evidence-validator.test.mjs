import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { validateEvidenceTarget } from "../validate-evidence.mjs";

const jsonFiles = ["manifest.json", "environment.json", "settings.json", "trajectory.json", "results.json", "correctness.json"];

function hash(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }

function bundle() {
  const root = mkdtempSync(join(tmpdir(), "evidence-validator-test-"));
  const directory = join(root, "bundle");
  mkdirSync(directory);
  for (const file of jsonFiles) {
    const value = file === "manifest.json"
      ? { schemaVersion: 1, commit: "test", dirty: true, commands: [], outcomes: [] }
      : { schemaVersion: 1 };
    writeFileSync(join(directory, file), `${JSON.stringify(value)}\n`);
  }
  writeFileSync(join(directory, "checksums.sha256"), jsonFiles.map((file) => `${hash(join(directory, file))}  ${file}`).join("\n") + "\n");
  return { root, directory };
}

test("accepts a complete checksummed directory", () => {
  assert.equal(validateEvidenceTarget(bundle().directory).valid, true);
});

test("rejects malformed JSON", () => {
  const { directory } = bundle();
  writeFileSync(join(directory, "results.json"), "{");
  assert.throws(() => validateEvidenceTarget(directory), /malformed JSON/);
});

test("rejects a checksum mismatch", () => {
  const { directory } = bundle();
  writeFileSync(join(directory, "results.json"), "{}\n");
  assert.throws(() => validateEvidenceTarget(directory), /checksum mismatch/);
});

test("validates ZIP integrity and contents when zip is available", (context) => {
  const { root } = bundle();
  if (spawnSync("zip", ["-v"], { stdio: "ignore" }).status !== 0) return context.skip("zip unavailable");
  const path = join(root, "bundle.zip");
  assert.equal(spawnSync("zip", ["-qr", path, "bundle"], { cwd: root }).status, 0);
  assert.equal(validateEvidenceTarget(path).valid, true);
  writeFileSync(path, "not a zip");
  assert.throws(() => validateEvidenceTarget(path), /ZIP listing failed|ZIP integrity failed/);
});
