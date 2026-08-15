import {
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import {
  delimiter,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";

const relatedName = /(?:^|[^a-z0-9])webgpu[-_ ]?zoomer(?:[^a-z0-9]|$)/i;
const relatedRemote = /(?:^|[/:])byronbuzz\/webgpu-zoomer(?:\.git)?(?:$|\s)/im;

function normalize(candidate) {
  const absolute = resolve(candidate);
  try {
    return realpathSync.native(absolute);
  } catch {
    return absolute;
  }
}

function pathKey(candidate) {
  const normalized = normalize(candidate);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

export function isWithin(candidate, parent) {
  const childPath = pathKey(candidate);
  const parentPath = pathKey(parent);
  const offset = relative(parentPath, childPath);
  return offset === "" || (!offset.startsWith(`..${sep}`) && offset !== ".." && !isAbsolute(offset));
}

function readGitConfig(markerPath) {
  try {
    if (statSync(markerPath).isDirectory()) {
      return readFileSync(join(markerPath, "config"), "utf8");
    }

    const marker = readFileSync(markerPath, "utf8").trim();
    const match = /^gitdir:\s*(.+)$/i.exec(marker);
    if (!match) return "";
    const gitDirectory = resolve(dirname(markerPath), match[1]);
    const commonMarker = join(gitDirectory, "commondir");
    const commonDirectory = existsSync(commonMarker)
      ? resolve(gitDirectory, readFileSync(commonMarker, "utf8").trim())
      : gitDirectory;
    return readFileSync(join(commonDirectory, "config"), "utf8");
  } catch {
    return "";
  }
}

export function checkContainment({ canonicalPath, scanRoots }) {
  const canonical = normalize(canonicalPath);
  const violations = new Map();
  const scanErrors = [];
  const roots = [...new Map(scanRoots.map((root) => [pathKey(root), normalize(root)])).values()];

  for (const root of roots) {
    if (!existsSync(root)) continue;
    const pending = [root];

    while (pending.length > 0) {
      const current = pending.pop();
      if (isWithin(current, canonical)) continue;

      let entries;
      try {
        entries = readdirSync(current, { withFileTypes: true });
      } catch (error) {
        scanErrors.push({ path: current, error: error.message });
        continue;
      }

      for (const entry of entries) {
        const fullPath = join(current, entry.name);
        if (isWithin(fullPath, canonical)) continue;

        if (relatedName.test(entry.name)) {
          violations.set(pathKey(fullPath), normalize(fullPath));
          continue;
        }

        if (entry.name === ".git") {
          if (relatedRemote.test(readGitConfig(fullPath))) {
            violations.set(pathKey(current), normalize(current));
          }
          continue;
        }

        if (entry.isDirectory() && entry.name === "node_modules") {
          const scopedDependency = join(fullPath, "@webgpu-zoomer");
          if (existsSync(scopedDependency)) {
            violations.set(pathKey(scopedDependency), normalize(scopedDependency));
          }
          continue;
        }

        if (entry.isDirectory()) pending.push(fullPath);
      }
    }
  }

  return {
    canonicalPath: canonical,
    scannedRoots: roots,
    violations: [...violations.values()].sort(),
    scanErrors,
  };
}

function defaultScanRoots(expectedPath) {
  const configured = process.env.WEBGPU_ZOOMER_CONTAINMENT_ROOTS;
  if (configured) return configured.split(delimiter).filter(Boolean);

  return [
    dirname(expectedPath),
    "G:\\My Drive\\Coding",
    join(homedir(), "Documents", "GitHub"),
    join(homedir(), ".codex", ".chatgpt-projects"),
    tmpdir(),
  ];
}

function main() {
  const repositoryRoot = normalize(fileURLToPath(new URL("..", import.meta.url)));
  const expectedPath = normalize(process.env.WEBGPU_ZOOMER_CANONICAL_PATH ?? "F:\\Coding\\WebGPU-Zoomer");
  const result = checkContainment({
    canonicalPath: expectedPath,
    scanRoots: defaultScanRoots(expectedPath),
  });

  const locationMatches = pathKey(repositoryRoot) === pathKey(expectedPath);
  console.log(JSON.stringify({ ...result, repositoryRoot, locationMatches }, null, 2));
  if (!locationMatches || result.violations.length > 0 || result.scanErrors.length > 0) process.exit(1);
}

if (process.argv[1] && pathKey(process.argv[1]) === pathKey(fileURLToPath(import.meta.url))) main();
