import { expect, test } from "playwright/test";

test("isolated stable browser harness reports capabilities", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.headers()["cross-origin-opener-policy"]).toBe("same-origin");
  expect(response?.headers()["cross-origin-embedder-policy"]).toBe("require-corp");
  const capabilities = JSON.parse(await page.locator("#capabilities").innerText());
  expect(capabilities.crossOriginIsolated).toBe(true);
  expect(capabilities.sharedArrayBuffer).toBe(true);
  expect(capabilities.webGpu).toBe(true);
});
