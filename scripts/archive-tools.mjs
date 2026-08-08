import { spawnSync } from "node:child_process";
import { basename, dirname } from "node:path";

function succeeds(command, args) {
  return spawnSync(command, args, { stdio: "ignore" }).status === 0;
}

function zipReader() {
  if (succeeds("unzip", ["-v"])) return "unzip";
  if (process.platform === "win32" && succeeds("tar.exe", ["--version"])) return "tar.exe";
  throw new Error("ZIP validation requires unzip, or Windows bsdtar");
}

export function listZip(path) {
  const command = zipReader();
  const run = command === "unzip"
    ? spawnSync(command, ["-Z1", path], { encoding: "utf8" })
    : spawnSync(command, ["-tf", path], { encoding: "utf8" });
  if (run.status !== 0) throw new Error(`ZIP listing failed: ${(run.stderr || run.stdout).trim()}`);
  return run.stdout.split(/\r?\n/).filter(Boolean);
}

export function extractZip(path, destination) {
  const command = zipReader();
  const run = command === "unzip"
    ? spawnSync(command, ["-q", path, "-d", destination], { encoding: "utf8" })
    : spawnSync(command, ["-xf", path, "-C", destination], { encoding: "utf8" });
  if (run.status !== 0) throw new Error(`ZIP extraction failed: ${(run.stderr || run.stdout).trim()}`);
}

export function createZip(sourceDirectory, output) {
  const sourceName = basename(sourceDirectory);
  const sourceParent = dirname(sourceDirectory);
  const run = succeeds("zip", ["-v"])
    ? spawnSync("zip", ["-qr", output, sourceName], { cwd: sourceParent, encoding: "utf8" })
    : process.platform === "win32"
      ? spawnSync("tar.exe", ["-a", "-cf", output, sourceName], { cwd: sourceParent, encoding: "utf8" })
      : { status: 127, stderr: "zip command unavailable" };
  if (run.status !== 0) throw new Error(`ZIP creation failed: ${(run.stderr || run.stdout).trim()}`);
}
