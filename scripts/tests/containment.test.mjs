import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { checkContainment } from "../check-containment.mjs";

test("containment detects named artifacts and repositories outside the canonical root", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "containment-check-"));
  try {
    const canonical = join(fixtureRoot, "F", "Coding", "WebGPU-Zoomer");
    const outside = join(fixtureRoot, "G", "Coding");
    const hiddenRepository = join(fixtureRoot, "C", "random-checkout");
    mkdirSync(join(canonical, "node_modules", "@webgpu-zoomer"), { recursive: true });
    mkdirSync(outside, { recursive: true });
    mkdirSync(join(hiddenRepository, ".git"), { recursive: true });
    writeFileSync(join(outside, "webgpu-zoomer.zip"), "fixture");
    writeFileSync(
      join(hiddenRepository, ".git", "config"),
      '[remote "origin"]\n\turl = https://github.com/byronbuzz/webgpu-zoomer.git\n',
    );

    const result = checkContainment({
      canonicalPath: canonical,
      scanRoots: [join(fixtureRoot, "F"), join(fixtureRoot, "G"), join(fixtureRoot, "C")],
    });

    assert.deepEqual(result.scanErrors, []);
    assert.equal(result.violations.length, 2);
    assert.ok(result.violations.some((entry) => entry.endsWith("webgpu-zoomer.zip")));
    assert.ok(result.violations.some((entry) => entry.endsWith("random-checkout")));
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
