import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import {
  BuyerOrderDetailSchema,
  HoldSeatsResponseDataSchema,
  type BuyerOrderDetail,
} from "@tickethub/shared";
import { payByLocalIpn } from "./helpers/paid-order";

// Mua ve that tren database test rieng.
const api = process.env.W04_API_URL || "http://localhost:4000/api/v1";
const slug = "liveshow-am-nhac-mua-thu-2026";
test.describe.configure({ mode: "serial" });
test.use({ serviceWorkers: "block" });
test.skip(
  process.env.W04_E2E_ISOLATED !== "true" ||
    process.env.W04_IPN_TEST !== "true",
  "Cần API test riêng bật ENABLE_VNPAY_IPN_PROCESSING=true",
);
if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE)
  test.use({
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
  });

let token = "";
let user: unknown;
let standing: BuyerOrderDetail;
let seated: BuyerOrderDetail;
const headers = () => ({ Authorization: `Bearer ${token}` });

async function buy(
  request: APIRequestContext,
  quantity: number,
  isSeated: boolean,
) {
  const event = (await (await request.get(`${api}/events/${slug}`)).json())
    .data;
  const type = event.ticketTypes.find(
    (t: { isSeated: boolean }) => t.isSeated === isSeated,
  );
  const held = await request.post(`${api}/booking/hold`, {
    headers: headers(),
    data: { eventId: event.id, items: [{ ticketTypeId: type.id, quantity }] },
  });
  expect(held.status()).toBe(201);
  const { orderId } = HoldSeatsResponseDataSchema.parse(
    (await held.json()).data,
  );
  await payByLocalIpn(request, api, headers(), orderId);
  const detail = await request.get(`${api}/buyer/orders/${orderId}`, {
    headers: headers(),
  });
  return BuyerOrderDetailSchema.parse((await detail.json()).data);
}

test.beforeAll(async ({ request }) => {
  const login = await request.post(`${api}/auth/login`, {
    data: { email: "buyer@tickethub.vn", password: "Password123!" },
  });
  const { data } = await login.json();
  token = data.accessToken;
  user = data.user;
  standing = await buy(request, 6, false);
  seated = await buy(request, 2, true);
});

/** Mo trang don voi dong ho gia, dem so lan xin ma. */
async function openOrder(page: Page, order: BuyerOrderDetail) {
  await page
    .context()
    .addCookies([
      { name: "accessToken", value: token, url: "http://localhost:3000" },
    ]);
  await page.addInitScript(
    (value) => localStorage.setItem("tickethub_user", JSON.stringify(value)),
    user,
  );
  const calls: string[] = [];
  page.on("request", (r) => {
    if (/\/tickets\/[^/]+\/qr$/.test(r.url())) calls.push(r.url());
  });
  await page.clock.install();
  await page.goto(`/buyer/orders/${order.id}`);
  return calls;
}
const qrImage = (page: Page) =>
  page.getByRole("dialog").getByRole("img", { name: /^Mã QR vé/ });
const enter = (page: Page) =>
  page.getByRole("button", { name: "Hiện mã vào cổng" }).click();

test("Mở mã, tự đổi sau 30 giây và chuyển giữa các vé", async ({ page }) => {
  const calls = await openOrder(page, standing);
  await enter(page);
  await expect(qrImage(page)).toBeVisible();
  const first = await qrImage(page).getAttribute("src");
  const before = calls.length;
  await page.clock.runFor(31_000);
  await expect.poll(() => calls.length).toBeGreaterThan(before);
  await expect.poll(() => qrImage(page).getAttribute("src")).not.toBe(first);
  const dialog = page.getByRole("dialog");
  const codes = standing.tickets.map((t) => t.ticketCode);
  await expect(dialog.getByTitle("Chạm để sao chép")).toHaveText(codes[0]!);
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByTitle("Chạm để sao chép")).toHaveText(codes[1]!);
  await expect(qrImage(page)).toBeVisible();
  expect(calls.at(-1)).toContain(standing.tickets[1]!.id);
  await dialog.getByRole("button", { name: /^Vé 6:/ }).click();
  await expect(dialog.getByTitle("Chạm để sao chép")).toHaveText(codes[5]!);
});

test("Mất mạng thì mã hết hạn biến mất và thử lại được", async ({ page }) => {
  await openOrder(page, standing);
  await enter(page);
  await expect(qrImage(page)).toBeVisible();
  await page.route("**/tickets/*/qr", (route) =>
    route.abort("connectionrefused"),
  );
  await page.clock.runFor(31_000);
  await expect(page.getByText("Mã đã hết hạn")).toBeVisible();
  await expect(qrImage(page)).toHaveCount(0);
  await page.unroute("**/tickets/*/qr");
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(qrImage(page)).toBeVisible();
});

test("Máy chủ từ chối thì hiện lý do và ngừng xin mã", async ({ page }) => {
  await page.route("**/tickets/*/qr", (route) =>
    route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        error: { code: "TICKET_USED", message: "Vé đã được sử dụng" },
      }),
    }),
  );
  const calls = await openOrder(page, standing);
  await enter(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Không thể hiện mã");
  await expect(dialog).toContainText("Vé đã được sử dụng");
  const count = calls.length;
  await page.clock.runFor(90_000);
  expect(calls.length).toBe(count);
  await expect(qrImage(page)).toHaveCount(0);
});

test("Ẩn tab hoặc đóng hộp thoại thì ngừng xin mã", async ({ page }) => {
  const calls = await openOrder(page, standing);
  await enter(page);
  await expect(qrImage(page)).toBeVisible();
  const setVisibility = (state: string) =>
    page.evaluate((value) => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => value,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    }, state);
  await setVisibility("hidden");
  await expect(qrImage(page)).toHaveCount(0);
  let count = calls.length;
  await page.clock.runFor(90_000);
  expect(calls.length).toBe(count);
  await setVisibility("visible");
  await expect.poll(() => calls.length).toBeGreaterThan(count);
  await expect(qrImage(page)).toBeVisible();
  await page.getByRole("button", { name: "Đóng" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  count = calls.length;
  await page.clock.runFor(90_000);
  expect(calls.length).toBe(count);
});

test("Vé có ghế mở đúng chỗ ngồi; header và menu dùng được", async ({
  page,
}) => {
  await openOrder(page, seated);
  const ticket = seated.tickets[1]!;
  await page
    .getByTestId("order-ticket")
    .filter({ hasText: ticket.seatInfo.formattedLabel })
    .getByRole("button")
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(ticket.seatInfo.formattedLabel);
  await expect(dialog.getByTitle("Chạm để sao chép")).toHaveText(
    ticket.ticketCode,
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "Vé của tôi" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.getByRole("button", { name: "Tài khoản" }).click();
  await expect(page.getByText("buyer@tickethub.vn")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Trợ giúp", exact: true }),
  ).toBeVisible();
});

test("Màn 320px không tràn và mã đủ lớn", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openOrder(page, standing);
  const overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
  await expect(page.getByTestId("order-ticket")).toHaveCount(6);
  expect(await overflow()).toBeLessThanOrEqual(0);
  await enter(page);
  await expect(qrImage(page)).toBeVisible();
  const box = (await qrImage(page).boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(238);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.scrollWidth - el.clientWidth),
  ).toBeLessThanOrEqual(0);
});
