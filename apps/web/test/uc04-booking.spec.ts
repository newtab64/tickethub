import { test, expect, type Page } from "@playwright/test";

// Ghi giu cho that: chi chay tren CI hoac khi API dung database test rieng.
const api = process.env.W04_API_URL || "http://localhost:4000/api/v1";
const slug = "liveshow-am-nhac-mua-thu-2026";
test.describe.configure({ mode: "serial" });
test.use({ serviceWorkers: "block" });
test.skip(
  !process.env.CI && process.env.W04_E2E_ISOLATED !== "true",
  "Chỉ chạy trên CI hoặc database test riêng",
);
if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE)
  test.use({
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
  });

let token = "";
let orderId = "";

async function loginBrowser(page: Page) {
  const login = await page.request.post(`${api}/auth/login`, {
    data: { email: "buyer@tickethub.vn", password: "Password123!" },
  });
  expect(login.ok()).toBeTruthy();
  const { data } = await login.json();
  token = data.accessToken;
  await page
    .context()
    .addCookies([
      { name: "accessToken", value: token, url: "http://localhost:3000" },
    ]);
  await page.addInitScript(
    (value) => localStorage.setItem("tickethub_user", JSON.stringify(value)),
    data.user,
  );
}

test.afterEach(async ({ request }) => {
  if (!orderId) return;
  await request.post(`${api}/booking/release`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { orderId },
  });
  orderId = "";
});

test("Từ trang sự kiện giữ chỗ được và tới checkout", async ({ page }) => {
  await loginBrowser(page);
  await page.goto(`/events/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Liveshow Âm Nhạc Mùa Thu 2026",
  );
  await page.getByRole("link", { name: "Mua vé ngay" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Tiếp tục", exact: true })
    .click();
  const held = page.waitForResponse("**/api/v1/booking/hold");
  await page.getByRole("heading", { name: "Khu Đứng GA", exact: true }).click();
  const response = await held;
  expect(response.status()).toBe(201);
  const uuid = expect.stringMatching(/^[0-9a-f-]{36}$/);
  expect(response.request().postDataJSON()).toEqual({
    eventId: uuid,
    items: [{ ticketTypeId: uuid, quantity: 2 }],
  });
  orderId = (await response.json()).data.orderId;
  await page.getByRole("button", { name: /Thanh toán qua VNPay/ }).click();
  await expect(page).toHaveURL(`/checkout?orderId=${orderId}`);
  await expect(
    page.getByRole("button", { name: "Thanh toán ngay qua VNPay" }),
  ).toBeVisible();
});

test("Sự kiện không tồn tại không bị thay bằng sự kiện khác", async ({
  page,
}) => {
  for (const path of [
    "/events/khong-co-su-kien",
    "/events/khong-co-su-kien/booking",
  ]) {
    await page.goto(path);
    await expect(page.getByText("Không tìm thấy trang")).toBeVisible();
    await expect(page.getByText("Liveshow Âm Nhạc")).toHaveCount(0);
  }
});
