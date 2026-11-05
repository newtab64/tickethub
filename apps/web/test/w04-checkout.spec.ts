import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  HoldSeatsResponseDataSchema,
  BuyerOrderDetailSchema,
  VnpayPaymentResponseSchema,
} from "@tickethub/shared";

// Chạy trên API trỏ tới database _test, PostgreSQL/Redis thật và dữ liệu seed.
const api = process.env.W04_API_URL || "http://localhost:4000/api/v1";
test.describe.configure({ mode: "serial" });
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

test("Trang chủ lấy sự kiện thật và chọn vé đi tới checkout", async ({
  page,
  request,
}) => {
  await loginBrowser(page);
  const events = (await (await request.get(`${api}/events`)).json()).data.items;
  const event = events[0];
  await page.goto("/");
  await page.locator(`a[href="/events/${event.slug}"]`).first().click();
  await expect(
    page.getByRole("heading", { name: event.title, exact: true, level: 2 }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Mua vé ngay" }).click();
  await expect(page).toHaveURL(new RegExp(`/events/${event.slug}/booking`));
  await page.getByRole("radio").last().check();
  await page.getByLabel("Số lượng vé").selectOption("2");
  await page.getByRole("button", { name: "Giữ chỗ và tiếp tục" }).click();
  await expect(page).toHaveURL(/\/checkout\?orderId=/);
  const id = new URL(page.url()).searchParams.get("orderId");
  expect(id).toBeTruthy();
  createdOrders.push(id!);
  const order = BuyerOrderDetailSchema.parse(
    (
      await (
        await request.get(`${api}/buyer/orders/${id}`, { headers: headers() })
      ).json()
    ).data,
  );
  expect(order.event.id).toBe(event.id);
  expect(order.items.reduce((count, item) => count + item.quantity, 0)).toBe(2);
  await expect(page.getByText(order.orderCode, { exact: true })).toBeVisible();
  await page.screenshot({
    path: "../../artifacts/w04-live-entry-checkout.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Hủy giao dịch", exact: true })
    .click();
  await expect(page).toHaveURL(/\/events\//);
});

test("Đường dẫn sự kiện mẫu cũ không gửi ID giả để giữ chỗ", async ({
  page,
}) => {
  await loginBrowser(page);
  let holdRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/booking/hold")) holdRequests++;
  });
  await page.goto("/events/evt-ha-anh-tuan-sketch-a-rose");
  await expect(
    page.getByRole("link", { name: "Xem sự kiện đang mở bán" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Giữ chỗ và tiếp tục" }),
  ).toHaveCount(0);
  expect(holdRequests).toBe(0);
});

test("Thiếu đơn không tạo checkout giả và đơn không tồn tại không cho thanh toán", async ({
  page,
}) => {
  await loginBrowser(page);
  await page.goto("/checkout");
  await expect(page.getByRole("alert")).toContainText(
    "Không có mã đơn hàng hợp lệ",
  );
  await expect(
    page.getByRole("button", { name: "Thanh toán ngay qua VNPay" }),
  ).toHaveCount(0);
  await page.goto("/checkout?orderId=00000000-0000-4000-8000-000000000000");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Thanh toán ngay qua VNPay" }),
  ).toHaveCount(0);
});

test("Checkout đọc tiền thật, không áp voucher giả, hủy trả chỗ về backend", async ({
  page,
  request,
}) => {
  const order = await hold(request);
  await loginBrowser(page);
  await page.goto(`/checkout?orderId=${order.orderId}`);
  await expect(page.getByText(order.orderCode, { exact: true })).toBeVisible();
  await expect(page.getByRole("timer")).toContainText(/0[0-5]:[0-5][0-9]/);
  await page.getByLabel("Mã giảm giá").fill("VIP10");
  await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Chưa hỗ trợ áp dụng mã giảm giá",
  );
  await page.screenshot({
    path: "../../artifacts/w04-checkout-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: "../../artifacts/w04-checkout-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Hủy giao dịch", exact: true })
    .click();
  await expect(page).toHaveURL(/\/events\//);
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
  await expect(page.getByText(order.orderCode, { exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: "Đơn hàng của tôi", exact: true })
    .click();
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
  await expect(page.getByText(order.orderCode, { exact: true })).toBeVisible();
  await expect(page.getByText(/Hàng .* - Ghế/)).toHaveCount(2);
  await page
    .getByRole("button", { name: "Hủy giao dịch", exact: true })
    .click();
  await expect(page).toHaveURL(/\/events\//);
});

test("Mất kết nối thanh toán giữ nguyên đơn và không báo thành công", async ({
  page,
  request,
}) => {
  const order = await hold(request);
  await loginBrowser(page);
  await page.goto(`/checkout?orderId=${order.orderId}`);
  await expect(page.getByText(order.orderCode, { exact: true })).toBeVisible();
  await page.route("**/payments/orders/*/vnpay", (route) =>
    route.abort("connectionrefused"),
  );
  await page.getByRole("button", { name: "Thanh toán ngay qua VNPay" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Máy chủ API hiện chưa phản hồi" }),
  ).toBeVisible();
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

test("Đồng hồ cảnh báo và hết hạn giải phóng đơn thật", async ({
  page,
  request,
}) => {
  const order = await hold(request);
  await loginBrowser(page);
  await page.clock.install();
  await page.goto(`/checkout?orderId=${order.orderId}`);
  await expect(page.getByText(order.orderCode, { exact: true })).toBeVisible();
  await page.clock.fastForward(246_000);
  await expect(
    page.getByRole("alert").filter({ hasText: "Phiên giữ chỗ sắp hết hạn" }),
  ).toBeVisible();
  await page.clock.fastForward(60_000);
  await expect(page).toHaveURL(/holdExpired=1/);
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
  await expect(page.getByText(order.orderCode, { exact: true })).toBeVisible();
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
  const payment = VnpayPaymentResponseSchema.parse(
    (
      await (
        await request.post(`${api}/payments/orders/${order.orderId}/vnpay`, {
          headers: headers(),
        })
      ).json()
    ).data,
  );
  const params = new URLSearchParams({
    vnp_TmnCode: process.env.W04_VNPAY_TEST_TMN || "W04LOCALTEST",
    vnp_TxnRef: payment.transactionRef,
    vnp_Amount: String(payment.amountVnd * 100),
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
    vnp_TransactionNo: String(Date.now()),
    vnp_PayDate: "20261105220000",
  });
  params.sort();
  const signature = createHmac(
    "sha512",
    process.env.W04_VNPAY_TEST_SECRET || "w04-local-signature-fixture-only",
  )
    .update(params.toString())
    .digest("hex");
  params.set("vnp_SecureHash", signature);
  const ipn = await request.get(`${api}/payments/vnpay/ipn?${params}`);
  expect((await ipn.json()).RspCode).toBe("00");
  await page.goto(`/checkout/result?orderId=${order.orderId}`);
  await expect(
    page.getByRole("heading", { name: "Thanh toán thành công", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Xem chi tiết đơn hàng" }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(2);
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Xem trước số tiền hoàn" }).click();
  await expect(page.getByText("Tỷ lệ hoàn: 100%")).toBeVisible();
  await page.getByLabel("Lý do hủy").fill("Kiểm thử W04 hoàn một phần vé");
  await page.screenshot({
    path: "../../artifacts/w04-refund-preview.png",
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
  expect(actual.status).toBe("PAID");
  expect(actual.tickets.filter((t) => t.status === "CANCELLED")).toHaveLength(
    1,
  );
  expect(actual.tickets.filter((t) => t.status === "SOLD")).toHaveLength(1);
});
