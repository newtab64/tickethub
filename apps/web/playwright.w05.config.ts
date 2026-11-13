import { defineConfig, devices } from "@playwright/test";

// Chỉ dùng bởi runner. Khóa này không phải credential môi trường thực.
const testSecret = "tickethub-w05-browser-fixture-signing-key-only";
process.env.W05_MOCK_AUTH = "1";
process.env.W05_TEST_JWT_SECRET = testSecret;

export default defineConfig({
  testDir: "./test",
  testMatch: "w05-organizer-operations.spec.ts",
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000/auth",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      JWT_SECRET: testSecret,
      // Không dùng API đang chạy: toàn bộ response cần thiết do page.route cấp.
      NEXT_PUBLIC_API_URL: "http://127.0.0.1:47999/api/v1",
    },
  },
});
