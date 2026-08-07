import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, isAbsolute, join, normalize, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const requiredJson = ["manifest.json", "environment.json", "settings.json", "trajectory.json", "results.json", "correctness.json"];

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function safeArchiveEntries(path) {
  const listed = spawnSync("unzip", ["-Z1", path], { encoding: "utf8" });
  if (listed.status !== 0) throw new Error(`ZIP listing failed: ${listed.stderr.trim()}`);
  for (const entry of listed.stdout.split(/\r?\n/).filter(Boolean)) {
    const normalized = normalize(entry);
    if (isAbsolute(entry) || normalized === ".." || normalized.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) {
      throw new Error(`unsafe ZIP entry: ${entry}`);
    }
  }
}

function findBundleRoot(root) {
  if (existsSync(join(root, "manifest.json"))) return root;
  const directories = readdirSync(root).map((entry) => join(root, entry)).filter((path) => statSync(path).isDirectory());
  if (directories.length === 1 && existsSync(join(directories[0], "manifest.json"))) return directories[0];
  throw new Error("ZIP must contain one evidence bundle root");
}

export function validateEvidenceTarget(target) {
  let bundle = resolve(target);
  let temporary;
  try {
    if (bundle.endsWith(".zip")) {
      safeArchiveEntries(bundle);
      const test = spawnSync("unzip", ["-t", bundle], { encoding: "utf8" });
      if (test.status !== 0) throw new Error(`ZIP integrity failed: ${test.stderr.trim() || test.stdout.trim()}`);
      temporary = mkdtempSync(join(tmpdir(), "webgpu-zoomer-evidence-"));
      const extract = spawnSync("unzip", ["-q", bundle, "-d", temporary], { encoding: "utf8" });
      if (extract.status !== 0) throw new Error(`ZIP extraction failed: ${extract.stderr.trim()}`);
      bundle = findBundleRoot(temporary);
    }
    if (!statSync(bundle).isDirectory()) throw new Error("evidence target must be a directory or ZIP");

    const parsed = {};
    for (const file of requiredJson) {
      const path = join(bundle, file);
      if (!existsSync(path)) throw new Error(`missing required file: ${file}`);
      try { parsed[file] = JSON.parse(readFileSync(path, "utf8")); }
      catch (error) { throw new Error(`malformed JSON ${file}: ${error.message}`); }
    }
    const manifest = parsed["manifest.json"];
    for (const field of ["schemaVersion", "commit", "dirty", "commands", "outcomes"]) {
      if (!(field in manifest)) throw new Error(`manifest missing field: ${field}`);
    }

    const checksumPath = join(bundle, "checksums.sha256");
    if (!existsSync(checksumPath)) throw new Error("missing required file: checksums.sha256");
    const entries = readFileSync(checksumPath, "utf8").trim().split(/\r?\n/).filter(Boolean);
    const seen = new Set();
    for (const line of entries) {
      const match = /^([a-f0-9]{64})  ([^/].*)$/.exec(line);
      if (!match) throw new Error(`malformed checksum line: ${line}`);
      const [, expected, relative] = match;
      if (relative.includes("..") || isAbsolute(relative)) throw new Error(`unsafe checksum path: ${relative}`);
      const path = join(bundle, relative);
      if (!existsSync(path)) throw new Error(`checksum target missing: ${relative}`);
      if (sha256(path) !== expected) throw new Error(`checksum mismatch: ${relative}`);
      seen.add(relative);
    }
    for (const file of requiredJson) if (!seen.has(file)) throw new Error(`checksum missing for: ${file}`);
    return { valid: true, bundle: basename(bundle), jsonFiles: requiredJson.length, checksumEntries: entries.length };
  } finally {
    if (temporary) rmSync(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const target = process.argv[2];
    if (!target) throw new Error("usage: node scripts/validate-evidence.mjs <bundle-directory-or-zip>");
    console.log(JSON.stringify(validateEvidenceTarget(target), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
