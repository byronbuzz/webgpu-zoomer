import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "playwright/test";

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

test("isolated stable browser harness reports capabilities", async ({ page }) => {
  await page.goto("./");
  await expect.poll(() => page.evaluate(() => window.crossOriginIsolated)).toBe(true);
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
  await expect.poll(() => page.evaluate(() => window.crossOriginIsolated)).toBe(true);
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
