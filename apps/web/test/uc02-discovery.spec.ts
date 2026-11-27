import { test, expect } from "@playwright/test";

// Chi doc du lieu seed nen chay duoc o moi moi truong co API.
test.use({ serviceWorkers: "block" });
if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE)
  test.use({
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
  });

test("Trang chủ liệt kê sự kiện thật và dẫn tới trang chi tiết", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Xem sự kiện" })).toHaveAttribute(
    "href",
    /^\/events\/[a-z0-9-]+$/,
  );
  await expect(page.locator('a[href*="/events/evt-"]')).toHaveCount(0);
  const trending = page.getByRole("region", { name: /Sự kiện thịnh hành/ });
  await expect(trending.getByRole("heading", { level: 3 })).toHaveCount(4);
  const first = trending.getByRole("heading", { level: 3 }).first();
  const title = (await first.textContent())!;
  await first.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
});

test("Bộ lọc thể loại và thành phố lọc sự kiện thật", async ({ page }) => {
  await page.goto("/");
  const card = (name: RegExp) => page.getByRole("heading", { level: 3, name });
  await page.getByRole("button", { name: "Thể thao", exact: true }).click();
  await expect(card(/VBA Finals/).first()).toBeVisible();
  await expect(card(/À Ố Show/)).toHaveCount(0);

  await page.getByRole("button", { name: "Tất cả", exact: true }).click();
  const city = page.getByTestId("city-filter");
  for (let i = 0; i < 4; i++) {
    if ((await city.textContent())?.includes("Đà Nẵng")) break;
    await city.click();
  }
  await expect(city).toContainText("Đà Nẵng");
  await expect(card(/Chillies/).first()).toBeVisible();
  await expect(card(/VBA Finals/)).toHaveCount(0);

  // Da Nang khong co su kien the thao.
  await page.getByRole("button", { name: "Thể thao", exact: true }).click();
  await expect(
    page.getByText("Không có sự kiện phù hợp với bộ lọc"),
  ).toBeVisible();
});
