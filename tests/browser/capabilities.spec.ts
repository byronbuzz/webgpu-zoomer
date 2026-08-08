import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "playwright/test";
import {
  add,
  deserializeCamera,
  deserializeDyadic,
  multiply,
  type ExactCamera,
  type ExactDyadic,
  type SerializedCamera,
} from "@webgpu-zoomer/exact-camera";

type HarnessResult = Readonly<{
  schemaVersion: number;
  status: "passed" | "failed";
  environment: { info: { isFallbackAdapter: boolean } };
  summary: {
    fixtureCount: number;
    oracleMismatchCount: number;
    gpuDifferentialCount: number;
    gpuMismatchCount: number;
    acceptedGpuEscapes: number;
    intentionalInsufficientBoundPassed: boolean;
    fallbackAdapter: boolean;
  };
}>;

async function waitForIsolation(page: import("playwright/test").Page): Promise<void> {
  await expect.poll(async () => {
    try {
      return await page.evaluate(() => window.crossOriginIsolated);
    } catch {
      return false;
    }
  }).toBe(true);
}

async function readCamera(page: import("playwright/test").Page): Promise<ExactCamera> {
  const encoded = await page.locator("#preview").getAttribute("data-camera");
  if (!encoded) throw new Error("Camera state is not published for inspection.");
  return deserializeCamera(JSON.parse(encoded) as SerializedCamera);
}

function worldAtFocus(camera: ExactCamera, focusX: ExactDyadic, focusY: ExactDyadic) {
  return {
    x: add(camera.centerX, multiply(focusX, camera.viewportScale)),
    y: add(camera.centerY, multiply(focusY, camera.viewportScale)),
  };
}

async function readLastFocus(page: import("playwright/test").Page): Promise<{ x: ExactDyadic; y: ExactDyadic }> {
  const encoded = await page.locator("#preview").getAttribute("data-last-focus");
  if (!encoded) throw new Error("The quantized pointer focus was not recorded.");
  const value = JSON.parse(encoded) as {
    x: { numerator: string; exponent: string };
    y: { numerator: string; exponent: string };
  };
  return { x: deserializeDyadic(value.x), y: deserializeDyadic(value.y) };
}

test("isolated stable browser harness reports capabilities", async ({ page }) => {
  await page.goto("./");
  await waitForIsolation(page);
  const response = await page.reload();
  expect(response?.headers()["cross-origin-opener-policy"]).toBe("same-origin");
  expect(response?.headers()["cross-origin-embedder-policy"]).toBe("require-corp");
  await page.locator("details.diagnostics").evaluate((details: HTMLDetailsElement) => { details.open = true; });
  const capabilities = JSON.parse(await page.locator("#capabilities").innerText());
  expect(capabilities.crossOriginIsolated).toBe(true);
  expect(capabilities.sharedArrayBuffer).toBe(true);
  expect(capabilities.webGpu).toBe(true);
  await expect(page.locator("#preview")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#mandelbrot")).toBeVisible();
});

test("WASM oracle and direct WebGPU corpus pass conservatively", async ({ page, browser }, testInfo) => {
  await page.goto("./");
  await waitForIsolation(page);
  await page.locator("details.diagnostics").evaluate((details: HTMLDetailsElement) => { details.open = true; });
  await page.getByRole("button", { name: "Run deterministic corpus" }).click();
  await expect(page.locator("#results")).toHaveAttribute("data-state", /passed|failed|error/, { timeout: 120_000 });

  const raw = await page.locator("#results").innerText();
  const result = JSON.parse(raw) as HarnessResult & { error?: string };
  const evidence = {
    ...result,
    browserVersion: browser.version(),
    playwrightProject: testInfo.project.name,
  };
  const outputPath = process.env.WEBGPU_ZOOMER_RESULT_PATH
    ? resolve(process.env.WEBGPU_ZOOMER_RESULT_PATH)
    : testInfo.outputPath("phase-0-browser.json");
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await testInfo.attach("phase-0-browser-evidence", { path: outputPath, contentType: "application/json" });

  expect(result.error).toBeUndefined();
  expect(result.schemaVersion).toBe(1);
  expect(result.status).toBe("passed");
  expect(result.environment.info.isFallbackAdapter).toBe(false);
  expect(result.summary).toMatchObject({
    fixtureCount: 10,
    oracleMismatchCount: 0,
    gpuDifferentialCount: 4,
    gpuMismatchCount: 0,
    acceptedGpuEscapes: 3,
    intentionalInsufficientBoundPassed: true,
    fallbackAdapter: false,
  });
});

test("exact camera preserves pointer focus and wheel round trips", async ({ page }) => {
  await page.goto("./");
  await waitForIsolation(page);
  await expect(page.locator("#preview")).toHaveAttribute("data-state", "ready");

  const canvas = page.locator("#mandelbrot");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Mandelbrot canvas has no layout bounds.");
  const focusBits = Number(await page.locator("#preview").getAttribute("data-focus-quantization-bits"));
  expect(bounds.height / 2 ** (focusBits + 1)).toBeLessThan(0.001);
  const pointer = {
    x: bounds.x + bounds.width * 0.72,
    y: bounds.y + bounds.height * 0.38,
  };
  const before = await readCamera(page);
  await page.mouse.move(pointer.x, pointer.y);
  await page.mouse.wheel(0, -100);
  await expect.poll(async () => (await readCamera(page)).epoch > before.epoch).toBe(true);

  const inward = await readCamera(page);
  const inwardFocus = await readLastFocus(page);
  const invariantFocus = worldAtFocus(before, inwardFocus.x, inwardFocus.y);
  expect(worldAtFocus(inward, inwardFocus.x, inwardFocus.y)).toEqual(invariantFocus);
  await page.mouse.wheel(0, 100);
  await expect.poll(async () => (await readCamera(page)).epoch > inward.epoch).toBe(true);

  const roundTrip = await readCamera(page);
  expect(await readLastFocus(page)).toEqual(inwardFocus);
  expect(roundTrip.centerX).toEqual(before.centerX);
  expect(roundTrip.centerY).toEqual(before.centerY);
  expect(roundTrip.viewportScale).toEqual(before.viewportScale);

  await page.mouse.down();
  await page.waitForTimeout(420);
  await page.mouse.up();
  const heldZoom = await readCamera(page);
  expect(heldZoom.epoch - roundTrip.epoch).toBeGreaterThanOrEqual(2n);
  const heldFocus = await readLastFocus(page);
  expect(worldAtFocus(heldZoom, heldFocus.x, heldFocus.y)).toEqual(worldAtFocus(roundTrip, heldFocus.x, heldFocus.y));
  await expect(page.locator("#preview")).toHaveAttribute("data-presentation-state", "settled");
  const telemetry = JSON.parse((await page.locator("#preview").getAttribute("data-motion-telemetry")) ?? "null") as {
    frameCount: number;
    maximumFocusErrorPx: number;
    p95FrameMs: number;
    sampleCount: number;
    authority: string;
  } | null;
  expect(telemetry).not.toBeNull();
  expect(telemetry!.frameCount).toBeGreaterThanOrEqual(6);
  expect(telemetry!.sampleCount).toBeGreaterThanOrEqual(4);
  expect(telemetry!.maximumFocusErrorPx).toBeLessThan(0.75);
  expect(telemetry!.p95FrameMs).toBeLessThan(100);
  expect(telemetry!.authority).toBe("presentation-only");

  let previousEpoch = heldZoom.epoch;
  for (let step = 0; step < 40; step += 1) {
    await page.mouse.wheel(0, -100);
    await expect.poll(async () => (await readCamera(page)).epoch > previousEpoch).toBe(true);
    previousEpoch = (await readCamera(page)).epoch;
    if (await page.locator("#preview").getAttribute("data-state") === "precision-limit") break;
  }
  await expect(page.locator("#preview")).toHaveAttribute("data-state", "precision-limit");
  const limitedCamera = await readCamera(page);
  await page.mouse.wheel(0, -100);
  await expect.poll(async () => (await readCamera(page)).epoch > limitedCamera.epoch).toBe(true);
  await expect(page.locator("#preview")).toHaveAttribute("data-state", "precision-limit");

  await page.getByRole("button", { name: "Reset view" }).click();
  const reset = await readCamera(page);
  expect(reset.centerX).toEqual(before.centerX);
  expect(reset.centerY).toEqual(before.centerY);
  expect(reset.viewportScale).toEqual(before.viewportScale);
  await expect(page.locator("#preview")).toHaveAttribute("data-state", "ready");
});
