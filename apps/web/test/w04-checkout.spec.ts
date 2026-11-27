import {
  test,
  expect,
  type APIRequestContext,
  type Page,
  type Locator,
} from "@playwright/test";
import {
  HoldSeatsResponseDataSchema,
  BuyerOrderDetailSchema,
} from "@tickethub/shared";
import { payByLocalIpn } from "./helpers/paid-order";

// Chạy trên API trỏ tới database _test, PostgreSQL/Redis thật và dữ liệu seed.
const api = process.env.W04_API_URL || "http://localhost:4000/api/v1";
test.describe.configure({ mode: "serial" });
test.use({ serviceWorkers: "block" });
test.skip(
  process.env.W04_E2E_ISOLATED !== "true",
  "Chỉ chạy khi API dùng database test riêng có thể dọn sau suite",
);
if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE)
  test.use({
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
  });
let token: string;
let user: unknown;
const createdOrders: string[] = [];
const headers = () => ({ Authorization: `Bearer ${token}` });

test.beforeAll(async ({ request }) => {
  const login = await request.post(`${api}/auth/login`, {
    data: { email: "buyer@tickethub.vn", password: "Password123!" },
  });
  expect(login.ok()).toBeTruthy();
  const payload = await login.json();
  token = payload.data.accessToken;
  user = payload.data.user;
});
test.afterAll(async ({ request }) => {
  for (const orderId of createdOrders)
    await request.post(`${api}/booking/release`, {
      headers: headers(),
      data: { orderId },
    });
});
async function loginBrowser(page: Page) {
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
const top = async (locator: Locator) => (await locator.boundingBox())!.y;

/** Tổng tiền bên trái và nút thanh toán bên phải phải cùng đáy. */
async function expectAligned(page: Page) {
  const total = (await page.getByTestId("checkout-total").boundingBox())!;
  const pay = (await page
    .getByRole("button", { name: "Thanh toán ngay qua VNPay" })
    .boundingBox())!;
  expect(
    Math.abs(total.y + total.height - (pay.y + pay.height)),
  ).toBeLessThanOrEqual(1);
}

async function cancelHold(page: Page) {
  await page
    .getByRole("button", { name: "Hủy giao dịch", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Hủy giữ chỗ", exact: true })
    .click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/);
}
async function hold(request: APIRequestContext, quantity = 1, seated = false) {
  const response = await request.get(`${api}/events`);
  const events = await response.json();
  const event = events.data.items[0];
  expect(event).toBeTruthy();
  const map = await (await request.get(`${api}/events/${event.slug}`)).json();
  const zone = map.data.ticketTypes.find(
    (item: { isSeated: boolean }) => item.isSeated === seated,
  );
  expect(zone).toBeTruthy();
  const held = await request.post(`${api}/booking/hold`, {
    headers: headers(),
    data: { eventId: event.id, items: [{ ticketTypeId: zone.id, quantity }] },
  });
  expect(held.status()).toBe(201);
  const order = HoldSeatsResponseDataSchema.parse((await held.json()).data);
  createdOrders.push(order.orderId);
  return order;
}

test("Thiếu đơn không tạo checkout giả và đơn không tồn tại không cho thanh toán", async ({
  page,
}) => {
  await loginBrowser(page);
  await page.goto("/checkout");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Không có mã đơn hàng hợp lệ",
  );
  await expect(
    page.getByRole("button", { name: "Thanh toán ngay qua VNPay" }),
  ).toHaveCount(0);
  await page.goto("/checkout?orderId=00000000-0000-4000-8000-000000000000");
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Thanh toán ngay qua VNPay" }),
  ).toHaveCount(0);
});

test("F5 giữ nguyên đơn và deadline, sau đó vẫn hủy chủ động được", async ({
  page,
  request,
}) => {
  const held = await hold(request);
  await loginBrowser(page);
  await page.goto(`/checkout?orderId=${held.orderId}`);
  await expect(page.getByTestId("checkout-sheet")).toBeVisible();
  await expect(page.getByRole("timer")).toContainText(/0[0-5]:[0-5][0-9]/);
  const poster = page.getByRole("img", {
    name: "Ảnh sự kiện Liveshow Âm Nhạc Mùa Thu 2026",
  });
  await expect(poster).toBeVisible();
  await expect
    .poll(() =>
      poster.evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  const before = BuyerOrderDetailSchema.parse(
    (
      await (
        await request.get(`${api}/buyer/orders/${held.orderId}`, {
          headers: headers(),
        })
      ).json()
    ).data,
  );
  const releases: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/booking/release"))
      releases.push(request.url());
  });
  await page.reload();
  await expect(page.getByTestId("checkout-sheet")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Thanh toán ngay qua VNPay" }),
  ).toBeEnabled();
  const after = BuyerOrderDetailSchema.parse(
    (
      await (
        await request.get(`${api}/buyer/orders/${held.orderId}`, {
          headers: headers(),
        })
      ).json()
    ).data,
  );
  expect(after.status).toBe("PENDING");
  expect(after.expiresAt).toBe(before.expiresAt);
  expect(releases).toHaveLength(0);
  await cancelHold(page);
  const cancelled = (
    await (
      await request.get(`${api}/buyer/orders/${held.orderId}`, {
        headers: headers(),
      })
    ).json()
  ).data;
  expect(cancelled.status).toBe("CANCELLED");
});

test("Checkout đọc tiền thật, không áp voucher giả, hủy trả chỗ về backend", async ({
  page,
  request,
}) => {
  const order = await hold(request);
  await loginBrowser(page);
  await page.goto(`/checkout?orderId=${order.orderId}`);
  await expect(page.getByTestId("checkout-sheet")).toBeVisible();
  await expect(page.getByRole("timer")).toContainText(/0[0-5]:[0-5][0-9]/);
  // Ô mã giảm giá thu gọn cho tới khi người mua cần.
  await expect(page.getByLabel("Mã giảm giá")).toHaveCount(0);
  await page.getByRole("button", { name: "Thêm mã giảm giá" }).click();
  await expect(page.getByLabel("Mã giảm giá")).toBeFocused();
  await page.getByLabel("Mã giảm giá").fill("VIP10");
  await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Chưa hỗ trợ áp dụng mã giảm giá",
  );
  await page.screenshot({
    path: test.info().outputPath("w04-checkout-desktop.png"),
    fullPage: true,
  });
  const summary = page.getByRole("complementary", { name: "Tóm tắt đơn hàng" });
  const payment = page.getByRole("region", { name: "Thông tin thanh toán" });
  // Desktop: tóm tắt bên trái, thao tác bên phải, các khối cùng đáy.
  expect((await summary.boundingBox())!.x).toBeLessThan(
    (await payment.boundingBox())!.x,
  );
  await expectAligned(page);
  // Mobile theo luồng mua: mã giảm giá đứng ngay trên giá.
  await page.setViewportSize({ width: 320, height: 700 });
  const total = page.getByTestId("checkout-total");
  await expect
    .poll(
      async () =>
        (await top(page.getByLabel("Mã giảm giá"))) < (await top(total)),
    )
    .toBe(true);
  expect(await top(summary.getByRole("img"))).toBeLessThan(
    await top(payment.getByText("Vé gửi đến")),
  );
  expect(
    (await total.getByTestId("checkout-total-amount").boundingBox())!.height,
  ).toBeLessThan(40);
  const bar = page.getByRole("button", { name: "Thanh toán", exact: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(bar).toBeVisible();
  // Thanh nổi rộng bằng đúng các khối bên trong thẻ, ở cả điện thoại và tablet.
  for (const width of [320, 390, 700]) {
    await page.setViewportSize({ width, height: 700 });
    const pill = (await page.getByTestId("mobile-pay-bar").boundingBox())!;
    const block = (await total.boundingBox())!;
    expect([pill.x, pill.width]).toEqual([block.x, block.width]);
  }
  // Đúng cỡ chữ và bo góc của mockup: tên và gợi ý không gãy dòng trên 390px.
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    (await payment.getByText("buyer@tickethub.vn").boundingBox())!.height,
  ).toBeLessThan(30);
  await expect(
    page.getByRole("button", { name: "Thanh toán ngay qua VNPay" }),
  ).toHaveCSS("border-top-left-radius", "16px");
  // Mỗi thông tin chỉ nói một lần, không hiện giảm giá bằng 0.
  await expect(payment.getByText("Chọn tại cổng VNPay")).toBeVisible();
  await expect(page.getByText("Giảm giá", { exact: true })).toHaveCount(0);
  await expect(summary.getByText("Tạm tính")).toBeVisible();
  await page.setViewportSize({ width: 320, height: 700 });
  await page
    .getByRole("button", { name: "Thanh toán ngay qua VNPay" })
    .scrollIntoViewIfNeeded();
  await expect(bar).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });

  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: test.info().outputPath("w04-checkout-mobile.png"),
    fullPage: true,
  });
  await cancelHold(page);
  const actual = BuyerOrderDetailSchema.parse(
    (
      await (
        await request.get(`${api}/buyer/orders/${order.orderId}`, {
          headers: headers(),
        })
      ).json()
    ).data,
  );
  expect(actual.status).toBe("CANCELLED");
});

test("URL báo thành công không thay thế xác nhận backend và thoát trang trả chỗ", async ({
  page,
  request,
}) => {
  const order = await hold(request);
  await loginBrowser(page);
  await page.goto(
    `/checkout/result?orderId=${order.orderId}&vnp_ResponseCode=00&paymentSuccess=true`,
  );
  await expect(
    page.getByRole("heading", { name: "Đang chờ xác nhận thanh toán" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Thanh toán thành công", exact: true }),
  ).toHaveCount(0);
  await page.goto(`/checkout?orderId=${order.orderId}`);
  await expect(page.getByTestId("checkout-sheet")).toBeVisible();
  const ordersLink = page.getByRole("link", {
    name: "Đơn hàng của tôi",
    exact: true,
  });
  const dialog = page.getByRole("dialog");
  await ordersLink.click();
  await dialog.getByRole("button", { name: "Ở lại thanh toán" }).click();
  await expect(page).toHaveURL(/\/checkout\?orderId=/);
  await ordersLink.click();
  await dialog.getByRole("button", { name: "Hủy giữ chỗ" }).click();
  await expect(page).toHaveURL(/\/buyer\/orders$/);
  await expect
    .poll(async () => {
      const payload = await (
        await request.get(`${api}/buyer/orders/${order.orderId}`, {
          headers: headers(),
        })
      ).json();
      return payload.data.status;
    })
    .toBe("CANCELLED");
});

test("Vé có ghế hiển thị vị trí hệ thống tự phân bổ", async ({
  page,
  request,
}) => {
  const order = await hold(request, 2, true);
  await loginBrowser(page);
  await page.goto(`/checkout?orderId=${order.orderId}`);
  await expect(page.getByTestId("checkout-sheet")).toBeVisible();
  await expect(page.getByText(/Hàng .*, ghế/)).toHaveCount(2);
  await cancelHold(page);
});

test("Sáu ghế và tên sự kiện dài không làm lệch hai cột", async ({
  page,
  request,
}) => {
  const order = await hold(request, 6, true);
  await loginBrowser(page);
  await page.route("**/booking/orders/*", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.data.event.title = "Đại nhạc hội ".repeat(12);
    await route.fulfill({ response, json: body });
  });
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto(`/checkout?orderId=${order.orderId}`);
  const list = page.getByLabel("Danh sách ghế");
  await expect(list).toBeVisible();
  expect(await list.evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(
    true,
  );
  await expectAligned(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("Điện thoại nhỏ: không tràn, không gãy dòng, hiện đủ ghế", async ({
  page,
  request,
}) => {
  const order = await hold(request, 6, true);
  await loginBrowser(page);
  const total = page.getByTestId("checkout-total");
  const bar = page.getByTestId("mobile-pay-bar");
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 700 });
    await page.goto(`/checkout?orderId=${order.orderId}`);
    await expect(bar).toBeVisible();
    // Nút nằm gọn trong thanh nổi với tổng tiền hàng chục triệu.
    const pill = (await bar.boundingBox())!;
    const button = (await bar.getByRole("button").boundingBox())!;
    expect
      .soft(button.x + button.width, `nút trong thanh ở ${width}px`)
      .toBeLessThanOrEqual(pill.x + pill.width);
    for (const [name, locator] of [
      [
        "tiêu đề",
        page.getByRole("heading", { name: "Thanh toán", exact: true }),
      ],
      ["nhãn tổng", total.getByText("Tổng thanh toán")],
      ["tên khu", page.getByText("Khu VIP A").first()],
      ["vị trí ghế", page.getByText(/Hàng .*, ghế/).first()],
    ] as const)
      expect
        .soft((await locator.boundingBox())!.height, `${name} ở ${width}px`)
        .toBeLessThan(34);
  }
  // Điện thoại chỉ có một cột nên không giấu ghế trong khung cuộn.
  expect
    .soft(
      await page
        .getByLabel("Danh sách ghế")
        .evaluate((e) => e.scrollHeight - e.clientHeight),
    )
    .toBeLessThanOrEqual(1);
});

test("Điện thoại: lỗi hủy giữ chỗ và cảnh báo sắp hết hạn đều đọc được", async ({
  page,
  request,
}) => {
  const order = await hold(request);
  await loginBrowser(page);
  await page.setViewportSize({ width: 390, height: 664 });
  await page.clock.install();
  await page.goto(`/checkout?orderId=${order.orderId}`);
  await page.route("**/booking/release", (route) =>
    route.fulfill({
      status: 500,
      json: { success: false, error: { code: "E", message: "Chưa hủy được" } },
    }),
  );
  await page
    .getByRole("button", { name: "Hủy giao dịch", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Hủy giữ chỗ", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Chưa hủy được" }),
  ).toBeInViewport();
  await page.clock.fastForward(246_000);
  // Chữ đỏ cần nền trắng để đủ tương phản trên nền xám.
  await expect(
    page.getByRole("alert").filter({ hasText: "sắp hết hạn" }),
  ).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.unroute("**/booking/release");
});

test("Footer thẳng mép thẻ, không mang mã đơn, một lời cam kết", async ({
  page,
  request,
}) => {
  const order = await hold(request);
  await loginBrowser(page);
  await page.goto(`/checkout?orderId=${order.orderId}`);
  const sheet = page.getByTestId("checkout-sheet");
  const footer = page.getByRole("contentinfo");
  const row = footer.getByTestId("checkout-footer-row");
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 760 });
    const card = (await sheet.boundingBox())!;
    const line = (await row.boundingBox())!;
    expect([line.x, line.width], `mép ở ${width}px`).toEqual([
      card.x,
      card.width,
    ]);
  }
  await expect(page.getByText("Vé chính hãng.")).toHaveCount(1);
  await expect(footer.getByText("Vé chính hãng.")).toBeVisible();
  await expect(footer).not.toContainText("All Rights Reserved");
  await expect(footer.getByRole("link")).toHaveCount(4);
  await expect(page.getByText(order.orderCode)).toHaveCount(0);
  await expect(footer).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  // Cuộn hết trang: thanh nổi (nếu còn) không che liên kết nào.
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const bar = page.getByTestId("mobile-pay-bar");
  if (await bar.isVisible()) {
    const lastLink = (await footer.getByRole("link").last().boundingBox())!;
    await expect
      .poll(async () => (await bar.boundingBox())!.y)
      .toBeGreaterThan(lastLink.y + lastLink.height);
  }
});

test("Tài khoản thiếu họ tên vẫn hiện email nhận vé", async ({
  page,
  request,
}) => {
  const order = await hold(request);
  await loginBrowser(page);
  await page.addInitScript(
    (value) =>
      localStorage.setItem(
        "tickethub_user",
        JSON.stringify({ ...(value as object), fullName: "" }),
      ),
    user,
  );
  await page.goto(`/checkout?orderId=${order.orderId}`);
  const payment = page.getByRole("region", { name: "Thông tin thanh toán" });
  await expect(payment.getByText("Chưa cập nhật")).toBeVisible();
  await expect(payment.getByText("buyer@tickethub.vn")).toBeVisible();
});

test("Mất kết nối thanh toán giữ nguyên đơn và không báo thành công", async ({
  page,
  request,
}) => {
  const order = await hold(request);
  await loginBrowser(page);
  await page.goto(`/checkout?orderId=${order.orderId}`);
  await expect(page.getByTestId("checkout-sheet")).toBeVisible();
  await page.route("**/payments/orders/*/vnpay", (route) =>
    route.abort("connectionrefused"),
  );
  await page.getByRole("button", { name: "Thanh toán ngay qua VNPay" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Không kết nối được máy chủ thanh toán" }),
  ).toBeVisible();
  await expectAligned(page);
  await expect(page).toHaveURL(
    new RegExp(`/checkout\\?orderId=${order.orderId}`),
  );
  const result = await (
    await request.get(`${api}/buyer/orders/${order.orderId}`, {
      headers: headers(),
    })
  ).json();
  expect(result.data.status).toBe("PENDING");
});

test("Máy khách chạy nhanh giờ không làm hủy đơn", async ({
  page,
  request,
}) => {
  const order = await hold(request);
  await loginBrowser(page);
  await page.clock.install({ time: Date.now() + 6 * 60_000 });
  await page.goto(`/checkout?orderId=${order.orderId}`);
  await expect(page.getByRole("timer")).toContainText(/0[45]:[0-5][0-9]/);
  await expect(
    page.getByRole("button", { name: "Thanh toán ngay qua VNPay" }),
  ).toBeEnabled();
});

test("Đồng hồ cảnh báo và hết hạn giải phóng đơn thật", async ({
  page,
  request,
}) => {
  const order = await hold(request);
  await loginBrowser(page);
  await page.clock.install();
  await page.goto(`/checkout?orderId=${order.orderId}`);
  await expect(page.getByTestId("checkout-sheet")).toBeVisible();
  await page.clock.fastForward(246_000);
  await expect(
    page
      .getByRole("main")
      .getByRole("alert")
      .filter({ hasText: "Phiên giữ chỗ sắp hết hạn" }),
  ).toBeVisible();
  await page.clock.fastForward(60_000);
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}\?holdExpired=1/);
  await expect(
    page.getByRole("alert").filter({ hasText: "đã hết hạn" }),
  ).toBeVisible();
  const result = await (
    await request.get(`${api}/buyer/orders/${order.orderId}`, {
      headers: headers(),
    })
  ).json();
  expect(result.data.status).toBe("CANCELLED");
});

test("Nút thanh toán dùng URL backend và chuyển VNPay không hủy chỗ", async ({
  page,
  request,
}) => {
  test.skip(
    process.env.W04_IPN_TEST !== "true",
    "Cần cấu hình chữ ký fixture của API test cục bộ",
  );
  const order = await hold(request);
  await loginBrowser(page);
  await page.goto(`/checkout?orderId=${order.orderId}`);
  await expect(page.getByTestId("checkout-sheet")).toBeVisible();
  await page.route("https://sandbox.vnpayment.vn/**", (route) => route.abort());
  const navigation = page.waitForRequest((req) =>
    req.url().startsWith("https://sandbox.vnpayment.vn/"),
  );
  await page.getByRole("button", { name: "Thanh toán ngay qua VNPay" }).click();
  const gateway = new URL((await navigation).url());
  expect(gateway.searchParams.get("vnp_Amount")).toBe(
    String(order.totalAmount * 100),
  );
  expect(gateway.searchParams.get("vnp_SecureHash")).toMatch(/^[a-f0-9]{128}$/);
  await page.goto(
    `/checkout/vnpay-return?vnp_TxnRef=${gateway.searchParams.get("vnp_TxnRef")}&vnp_ResponseCode=00`,
  );
  await expect(
    page.getByRole("heading", { name: "Đang chờ xác nhận thanh toán" }),
  ).toBeVisible();
  const result = await (
    await request.get(`${api}/buyer/orders/${order.orderId}`, {
      headers: headers(),
    })
  ).json();
  expect(result.data.status).toBe("PENDING");
});

/** Vào chế độ hoàn vé, chọn dòng đầu tiên và mở phần xem trước. */
async function startRefund(page: Page) {
  await page.getByText("Chi tiết đơn", { exact: true }).click();
  await page.getByRole("button", { name: "Yêu cầu hoàn vé" }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(2);
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Xem số tiền hoàn cho 1 vé" }).click();
}

test("Xác nhận IPN cục bộ và hoàn một phần vé qua UI với database thật", async ({
  page,
  request,
}) => {
  test.skip(
    process.env.W04_IPN_TEST !== "true",
    "Cần API test riêng bật ENABLE_VNPAY_IPN_PROCESSING=true",
  );
  const order = await hold(request, 2);
  await loginBrowser(page);
  await payByLocalIpn(request, api, headers(), order.orderId);
  await page.goto(`/checkout/result?orderId=${order.orderId}`);
  await expect(
    page.getByRole("heading", { name: "Thanh toán thành công", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Xem chi tiết đơn hàng" }).click();
  const poster = page.getByRole("img", {
    name: "Ảnh sự kiện Liveshow Âm Nhạc Mùa Thu 2026",
  });
  await expect(poster).toBeVisible();
  await expect
    .poll(() =>
      poster.evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(page.getByTestId("order-ticket")).toHaveCount(2);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await startRefund(page);
  await expect(page.getByText("Tỷ lệ hoàn: 100%")).toBeVisible();
  await page.getByLabel("Lý do hủy").fill("Kiểm thử W04 hoàn một phần vé");
  await page.screenshot({
    path: test.info().outputPath("w04-refund-preview.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Xác nhận hủy vé", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Đã tiếp nhận yêu cầu hủy 1 vé",
  );
  const actual = BuyerOrderDetailSchema.parse(
    (
      await (
        await request.get(`${api}/buyer/orders/${order.orderId}`, {
          headers: headers(),
        })
      ).json()
    ).data,
  );
  await expect(page.getByTestId("order-ticket")).toHaveCount(1);
  expect(actual.status).toBe("PAID");
  expect(actual.tickets.filter((t) => t.status === "CANCELLED")).toHaveLength(
    1,
  );
  expect(actual.tickets.filter((t) => t.status === "SOLD")).toHaveLength(1);
});

test("Mất mạng khi xác nhận hoàn vé thì gửi lại đúng yêu cầu cũ", async ({
  page,
  request,
}) => {
  test.skip(
    process.env.W04_IPN_TEST !== "true",
    "Cần API test riêng bật ENABLE_VNPAY_IPN_PROCESSING=true",
  );
  const order = await hold(request, 2);
  await loginBrowser(page);
  await payByLocalIpn(request, api, headers(), order.orderId);
  const keys: string[] = [];
  await page.route("**/refund/request", (route) => {
    keys.push(route.request().headers()["idempotency-key"] ?? "");
    return keys.length === 1
      ? route.abort("connectionrefused")
      : route.continue();
  });
  await page.goto(`/buyer/orders/${order.orderId}`);
  await startRefund(page);
  await page.getByLabel("Lý do hủy").fill("Mất mạng khi hoàn vé");
  await page
    .getByRole("button", { name: "Xác nhận hủy vé", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Chưa xác nhận được kết quả");
  // Chưa biết kết quả thì không được đóng và tạo yêu cầu mới.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "Gửi lại cùng yêu cầu" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Đã tiếp nhận yêu cầu hủy 1 vé",
  );
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
});
