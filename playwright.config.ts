import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.spec.ts",
  use: {
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: "pnpm dev",
    env: {
      DATABASE_PATH: join(
        tmpdir(),
        "rentaldesk-e2e-" + randomUUID() + ".sqlite",
      ),
    },
    url: "http://127.0.0.1:5173/api/health",
    reuseExistingServer: false,
  },
});
