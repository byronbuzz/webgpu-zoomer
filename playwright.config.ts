import { defineConfig } from "playwright/test";

const channel = process.env.WEBGPU_ZOOMER_BROWSER_CHANNEL ?? "chrome";
const headless = process.env.WEBGPU_ZOOMER_HEADLESS === "1";
const externalBaseUrl = process.env.WEBGPU_ZOOMER_BASE_URL;

export default defineConfig({
  testDir: "tests/browser",
  timeout: 150_000,
  workers: 1,
  outputDir: "test-results/phase-0-browser",
  projects: [{
    name: `stable-${channel}-${headless ? "headless" : "headed"}`,
    use: {
      baseURL: externalBaseUrl ?? "http://127.0.0.1:4173/",
      browserName: "chromium",
      channel,
      headless,
    },
  }],
  webServer: externalBaseUrl ? undefined : {
    command: "npm exec vite -- apps/web --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
});
