import { test, expect, type Page } from "@playwright/test";
import { HoldSeatsResponseDataSchema } from "@tickethub/shared";

// Có giữ chỗ thật: chỉ chạy trên database test riêng.
const api = process.env.W04_API_URL || "http://localhost:4000/api/v1";
const LIST = /\/api\/v1\/buyer\/orders\?/;
const slug = "liveshow-am-nhac-mua-thu-2026";
test.describe.configure({ mode: "serial" });
test.use({ serviceWorkers: "block" });
test.skip(
  process.env.W04_E2E_ISOLATED !== "true",
  "Cần API dùng database test riêng",
);

let token = "";
let user: unknown;
let orderId = "";
let orderCode = "";

test.beforeAll(async ({ request }) => {
  const login = await request.post(`${api}/auth/login`, {
    data: { email: "buyer@tickethub.vn", password: "Password123!" },
  });
  const { data } = await login.json();
  token = data.accessToken;
  user = data.user;
  const event = (await (await request.get(`${api}/events/${slug}`)).json())
    .data;
  const held = await request.post(`${api}/booking/hold`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      eventId: event.id,
      items: [{ ticketTypeId: event.ticketTypes[0].id, quantity: 2 }],
    },
  });
  expect(held.status()).toBe(201);
  const order = HoldSeatsResponseDataSchema.parse((await held.json()).data);
  orderId = order.orderId;
  orderCode = order.orderCode;
});

test.afterAll(async ({ request }) => {
  await request.post(`${api}/booking/release`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { orderId },
  });
});

async function signIn(page: Page) {
  await page
    .context()
    .addCookies([
      { name: "accessToken", value: token, url: "http://localhost:3000" },
    ]);
  await page.addInitScript(
    (value) => localStorage.setItem("tickethub_user", JSON.stringify(value)),
    user,
  );
}

const row = (index: number, extra: Record<string, unknown> = {}) => ({
  id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  orderCode: `ORD-${index}`,
  eventId: "00000000-0000-4000-8000-0000000000aa",
  eventTitle: `Sự kiện ${index}`,
  eventBannerUrl: "/images/events/vn/anh-trai.jpg",
  eventStartTime: "2026-12-12T12:00:00.000Z",
  eventVenueName: "Nhà hát",
  status: "PAID",
  totalAmount: 100,
  discountAmount: 0,
  finalAmount: 100,
  ticketCount: 1,
  expiresAt: "2026-11-28T00:00:00.000Z",
  paidAt: null,
  createdAt: "2026-11-28T00:00:00.000Z",
  ...extra,
});
/** Danh sách giả cho các trạng thái giao diện khó dựng bằng dữ liệu thật. */
async function fakeList(
  page: Page,
  pages: (url: URL) => { data: unknown[]; totalPages: number },
) {
  await page.route(LIST, (route) => {
    const { data, totalPages } = pages(new URL(route.request().url()));
    return route.fulfill({
      json: { success: true, data, meta: { totalPages } },
    });
  });
}

test("Cả dòng đơn thật bấm được, có ảnh, không có mã đơn hay nút trả tiền", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/buyer/orders");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText(
    "Vé của tôi",
  );
  const link = main.locator(`a[href="/buyer/orders/${orderId}"]`);
  await expect(link).toContainText("Liveshow Âm Nhạc Mùa Thu 2026");
  await expect(link).toContainText("2 vé");
  await expect(link).toContainText("Chờ thanh toán");
  await expect(link.getByRole("img")).toBeVisible();
  await expect(main).not.toContainText(orderCode);
  await expect(main.getByText("Tiếp tục thanh toán")).toHaveCount(0);
  await expect(main.getByRole("button", { name: "Xem thêm" })).toHaveCount(0);
  await link.click();
  await expect(page).toHaveURL(`/buyer/orders/${orderId}`);
});

test("Lọc trạng thái bằng bàn phím; lọc không ra thì xem lại tất cả", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/buyer/orders");
  const filter = page.getByRole("combobox", { name: "Lọc theo trạng thái" });
  await expect(filter).toHaveText("Tất cả");
  await filter.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("option")).toHaveCount(8);
  await page.keyboard.press("End");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("option")).toHaveCount(0);
  await page.keyboard.press("Enter");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(filter).toHaveText("Hết hạn giữ chỗ, đang chờ hoàn tiền");
  await expect(filter).toBeFocused();
  const main = page.getByRole("main");
  await expect(main).toContainText("Không có đơn nào ở trạng thái này");
  await main.getByRole("button", { name: "Xem tất cả" }).click();
  await expect(filter).toHaveText("Tất cả");
  await expect(
    main.locator(`a[href="/buyer/orders/${orderId}"]`),
  ).toBeVisible();
});

test("Xem thêm nối trang, không trùng đơn, hết thì ẩn", async ({ page }) => {
  await signIn(page);
  await fakeList(page, (url) =>
    url.searchParams.get("page") === "1"
      ? { data: [row(1), row(2)], totalPages: 2 }
      : // Đơn mới chen vào làm đơn 2 lặp lại ở trang sau.
        { data: [row(2), row(3)], totalPages: 2 },
  );
  await page.goto("/buyer/orders");
  const rows = page.getByRole("main").getByRole("listitem");
  await expect(rows).toHaveCount(2);
  const more = page.getByRole("button", { name: "Xem thêm" });
  await more.focus();
  await page.keyboard.press("Enter");
  await expect(rows).toHaveCount(3);
  await expect(more).toHaveCount(0);
  // Nút biến mất thì tiêu điểm sang đơn mới đầu tiên.
  await expect(rows.nth(2).getByRole("link")).toBeFocused();
});

test("Chưa có vé, lỗi rồi thử lại, lỗi khi xem thêm", async ({ page }) => {
  await signIn(page);
  await page.route(LIST, (route) => route.abort("connectionrefused"));
  await page.goto("/buyer/orders");
  const main = page.getByRole("main");
  await expect(main).toContainText("Chưa tải được vé của bạn");
  await expect(main.getByRole("alert")).toHaveText(
    "Không kết nối được. Kiểm tra mạng rồi thử lại.",
  );
  await page.unroute(LIST);
  await fakeList(page, () => ({ data: [], totalPages: 0 }));
  await main.getByRole("button", { name: "Thử lại" }).click();
  await expect(main).toContainText("Bạn chưa có vé nào");
  await expect(
    main.getByRole("link", { name: "Khám phá sự kiện" }),
  ).toHaveAttribute("href", "/");
  await page.unroute(LIST);
  await page.route(LIST, (route) =>
    new URL(route.request().url()).searchParams.get("page") === "1"
      ? route.fulfill({
          json: { success: true, data: [row(1)], meta: { totalPages: 2 } },
        })
      : route.abort("connectionrefused"),
  );
  await page.reload();
  await main.getByRole("button", { name: "Xem thêm" }).click();
  await expect(main.getByRole("alert")).toBeVisible();
  await expect(main.getByRole("listitem")).toHaveCount(1);
  await expect(main.getByRole("button", { name: "Xem thêm" })).toBeVisible();
});

test("Màn 320px: tên và trạng thái dài không tràn, danh sách lọc nằm trong màn", async ({
  page,
}) => {
  await signIn(page);
  await fakeList(page, () => ({
    data: [
      row(1, {
        eventTitle: "Đại nhạc hội".repeat(8),
        status: "PAYMENT_EXPIRED_REFUND_PENDING",
      }),
    ],
    totalPages: 1,
  }));
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/buyer/orders");
  await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(1);
  const overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page.getByRole("combobox", { name: "Lọc theo trạng thái" }).click();
  const menu = (await page.getByRole("listbox").boundingBox())!;
  expect(menu.x).toBeGreaterThanOrEqual(0);
  expect(menu.x + menu.width).toBeLessThanOrEqual(320);
  // Không mục nào bị cắt chữ.
  expect(
    await page
      .getByRole("option")
      .locator("span")
      .evaluateAll(
        (labels) =>
          labels.filter((label) => label.scrollWidth > label.clientWidth)
            .length,
      ),
  ).toBe(0);
  // Chọn trạng thái dài nhất: ô lọc vẫn nằm trong màn.
  await page.getByRole("option").nth(6).click();
  expect(await overflow()).toBeLessThanOrEqual(0);
});

test("Hết phiên thì về trang đăng nhập kèm đường quay lại", async ({
  page,
}) => {
  await page.goto("/buyer/orders");
  await expect(page).toHaveURL(/\/auth\?redirect=.*buyer%2Forders/);
});
