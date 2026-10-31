import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  // testMatch: /uc02-search\.spec\.ts/,
  // testMatch: /uc0[23]-.*\.spec\.ts/,
  testMatch: /(uc02-search|uc03-queue|booking-concurrency)\.spec\.ts/,
  reporter: "list",
  workers: 1,
  use: {
    baseURL: "http://localhost:4000",
  },
});
