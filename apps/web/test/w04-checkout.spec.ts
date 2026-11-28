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

/** Bấm hủy ở khối đồng hồ rồi xác nhận trong hộp thoại. */
async function cancelFromCapsule(page: Page) {
  await page
    .getByTestId("hold-capsule")
    .getByRole("button", { name: "Hủy giao dịch" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Hủy giao dịch", exact: true })
    .click();
}

async function cancelHold(page: Page) {
  await page
    .getByRole("button", { name: "Hủy giao dịch", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Hủy giao dịch", exact: true })
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

test("Chưa đăng nhập: header trang kết quả mời đăng nhập", async ({ page }) => {
  await page.goto("/checkout/result");
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "Đăng nhập" })).toBeVisible();
  await expect(header.getByRole("link", { name: "Vé của tôi" })).toHaveCount(0);
  await expect(header.getByRole("button", { name: "Tài khoản" })).toHaveCount(
    0,
  );
});

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
  // Thanh nổi nền đen chữ trắng để tách khỏi thẻ.
  const floating = page.getByTestId("mobile-pay-bar");
  await expect(floating).toHaveCSS("background-color", "rgb(20, 29, 35)");
  await expect(floating.locator("strong")).toHaveCSS(
    "color",
    "rgb(255, 255, 255)",
  );
  // Thanh thụt vào so với thẻ 16px mỗi bên; màn hẹp thì rộng bằng thẻ.
  for (const [width, inset] of [
    [320, 0],
    [390, 16],
    [700, 16],
  ] as const) {
    await page.setViewportSize({ width, height: 700 });
    const pill = (await floating.boundingBox())!;
    const card = (await page.getByTestId("checkout-sheet").boundingBox())!;
    expect([pill.x, pill.width], `${width}px`).toEqual([
      card.x + inset,
      card.width - 2 * inset,
    ]);
  }
  // Đúng cỡ chữ và bo góc của mockup: tên và gợi ý không gãy dòng trên 390px.
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    (await payment.getByText("buyer@tickethub.vn").boundingBox())!.height,
  ).toBeLessThan(30);
  expect(
    (await page
      .getByRole("button", { name: "Thanh toán ngay qua VNPay" })
      .boundingBox())!.height,
  ).toBe(48);
  // Mỗi thông tin chỉ nói một lần; không có giảm giá thì không có tạm tính.
  await expect(
    payment.getByText("Bạn chọn cách trả ở bước tiếp theo."),
  ).toBeVisible();
  await expect(summary.getByText("Đã gồm VAT")).toBeVisible();
  await expect(page.getByText("Giảm giá", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Tạm tính")).toHaveCount(0);
  // "Tổng cộng" và số tiền cùng đường chân chữ.
  const baselines = await total.evaluate((block) =>
    [
      block.querySelector("[data-total-label]")!,
      block.querySelector('[data-testid="checkout-total-amount"]')!,
    ].map((element) => {
      const mark = document.createElement("span");
      mark.style.cssText =
        "display:inline-block;width:0;height:0;vertical-align:baseline";
      element.appendChild(mark);
      const y = mark.getBoundingClientRect().top;
      mark.remove();
      return y;
    }),
  );
  expect(Math.abs(baselines[0]! - baselines[1]!)).toBeLessThanOrEqual(1);
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
    name: "Vé của tôi",
    exact: true,
  });
  const dialog = page.getByRole("dialog");
  // Đang giữ chỗ thì không đăng xuất, và link trong menu vẫn hỏi trước khi rời.
  const account = page.getByRole("button", { name: "Tài khoản" });
  const menu = page.locator("#account-menu");
  await account.click();
  await expect(menu.getByRole("link", { name: "Trợ giúp" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Đăng xuất" })).toHaveCount(0);
  await menu.getByRole("link", { name: "Trợ giúp" }).click();
  // Không có nút X: "Tiếp tục thanh toán" đã làm đúng việc đó.
  await expect(dialog.getByRole("heading")).toHaveText("Hủy giao dịch?");
  await expect(dialog).toContainText("Ghế đang giữ sẽ được trả lại.");
  await expect(dialog.getByRole("button")).toHaveText([
    "Tiếp tục thanh toán",
    "Hủy giao dịch",
  ]);
  await dialog.getByRole("button", { name: "Tiếp tục thanh toán" }).click();
  await expect(page).toHaveURL(/\/checkout\?orderId=/);
  await expect(menu).toHaveCount(0);
  await account.click();
  await menu.getByRole("link", { name: "Trợ giúp" }).focus();
  await page.keyboard.press("Tab");
  await expect(menu).toHaveCount(0);
  await ordersLink.click();
  await dialog.getByRole("button", { name: "Tiếp tục thanh toán" }).click();
  await expect(page).toHaveURL(/\/checkout\?orderId=/);
  await ordersLink.click();
  await dialog.getByRole("button", { name: "Hủy giao dịch" }).click();
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
      ["nhãn tổng", total.getByText("Tổng cộng")],
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
    .getByRole("button", { name: "Hủy giao dịch", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Chưa hủy được" }),
  ).toBeInViewport();
  await page.clock.fastForward(246_000);
  // Không hiện câu cảnh báo; trình đọc màn hình vẫn được báo.
  const warning = page.getByRole("alert").filter({ hasText: "sắp hết hạn" });
  await expect(warning).toHaveCount(1);
  expect((await warning.boundingBox())!.width).toBeLessThanOrEqual(1);
  // Còn từ 45 giây thì khóa nút trả tiền.
  await page.clock.fastForward(10_000);
  await expect(
    page.getByRole("button", { name: "Thanh toán ngay qua VNPay" }),
  ).toBeDisabled();
  await page.unroute("**/booking/release");
});

test("Đồng hồ và nút hủy nằm chung một khối, vừa màn 320px", async ({
  page,
  request,
}) => {
  const order = await hold(request);
  await loginBrowser(page);
  await page.goto(`/checkout?orderId=${order.orderId}`);
  const capsule = page.getByTestId("hold-capsule");
  const cancel = capsule.getByRole("button", { name: "Hủy giao dịch" });
  await expect(capsule.getByRole("timer")).toBeVisible();
  await expect(cancel).toHaveText("Hủy giao dịch");
  const heading = page.getByRole("heading", {
    name: "Thanh toán",
    exact: true,
  });
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 700 });
    const box = (await capsule.boundingBox())!;
    const button = (await cancel.boundingBox())!;
    expect(box.x + box.width, `${width}px`).toBeLessThanOrEqual(width - 16);
    expect(button.x + button.width).toBeLessThanOrEqual(box.x + box.width);
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeLessThanOrEqual(60);
    // Điện thoại: chữ tiêu đề nhường chỗ, chỉ còn cho trình đọc màn hình.
    expect((await heading.boundingBox())!.width <= 1).toBe(width < 1024);
  }
  await cancelHold(page);
});

test("Có giảm giá thì hiện tạm tính; số tiền rất lớn vẫn vừa thanh nổi", async ({
  page,
  request,
}) => {
  const order = await hold(request);
  await loginBrowser(page);
  await page.route("**/booking/orders/*", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.data.totalAmount = 100_000_000_000;
    body.data.discountAmount = 1_000_000_000;
    body.data.finalAmount = 99_000_000_000;
    await route.fulfill({ response, json: body });
  });
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(`/checkout?orderId=${order.orderId}`);
  const total = page.getByTestId("checkout-total");
  await expect(total.getByText("Tạm tính")).toBeVisible();
  await expect(total.getByText("Giảm giá", { exact: true })).toBeVisible();
  const bar = page.getByTestId("mobile-pay-bar");
  await expect(bar).toBeVisible();
  const pill = (await bar.boundingBox())!;
  const button = (await bar.getByRole("button").boundingBox())!;
  expect(button.x + button.width).toBeLessThanOrEqual(pill.x + pill.width);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
  await page.setViewportSize({ width: 360, height: 700 });
  expect(
    (await total.getByText("Tổng cộng").boundingBox())!.height,
  ).toBeLessThan(34);
  // Số rất lớn vẫn không đẩy nút ra khỏi thanh nổi.
  for (const width of [360, 375]) {
    await page.setViewportSize({ width, height: 640 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(bar).toBeVisible();
    const outer = (await bar.boundingBox())!;
    const inner = (await bar.getByRole("button").boundingBox())!;
    expect(inner.x + inner.width, `${width}px`).toBeLessThanOrEqual(
      outer.x + outer.width - 4,
    );
  }
  await page.unroute("**/booking/orders/*");
  await cancelHold(page);
});

test("Màn 1280x800: sáu ghế mà nút trả tiền vẫn thấy ngay", async ({
  page,
  request,
}) => {
  const order = await hold(request, 6, true);
  await loginBrowser(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/checkout?orderId=${order.orderId}`);
  await expect(
    page.getByRole("button", { name: "Thanh toán ngay qua VNPay" }),
  ).toBeInViewport({ ratio: 1 });
  const list = page.getByLabel("Danh sách ghế");
  await expect(list).toHaveAttribute("tabindex", "0");
  // Ghế thứ ba ló một phần để người mua biết còn cuộn được.
  for (const height of [800, 900]) {
    await page.setViewportSize({ width: 1280, height });
    const frame = (await list.boundingBox())!;
    const third = (await list.getByRole("listitem").nth(2).boundingBox())!;
    const visible = frame.y + frame.height - third.y;
    expect(visible, `${height}px`).toBeGreaterThanOrEqual(16);
    expect(visible, `${height}px`).toBeLessThan(third.height);
  }
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "Liveshow Âm Nhạc Mùa Thu 2026",
    }),
  ).toHaveCount(1);
  await cancelHold(page);
});

test("Điện thoại nằm ngang: lỗi hủy không bị hàng đồng hồ che", async ({
  page,
  request,
}) => {
  const order = await hold(request);
  await loginBrowser(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto(`/checkout?orderId=${order.orderId}`);
  await page.route("**/booking/release", (route) =>
    route.fulfill({
      status: 500,
      json: { success: false, error: { code: "E", message: "Chưa hủy được" } },
    }),
  );
  await expect(page.getByTestId("checkout-sheet")).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await cancelFromCapsule(page);
  const error = page.getByRole("alert").filter({ hasText: "Chưa hủy được" });
  await expect(error).toBeInViewport({ ratio: 1 });
  const capsule = (await page.getByTestId("hold-capsule").boundingBox())!;
  await expect
    .poll(async () => (await error.boundingBox())!.y)
    .toBeGreaterThanOrEqual(capsule.y + capsule.height);
  await page.unroute("**/booking/release");
  await cancelHold(page);
});

test("Màn còn chỗ thì thẻ nằm giữa và chân trang sát đáy", async ({
  page,
  request,
}) => {
  const order = await hold(request);
  await loginBrowser(page);
  await page.goto(`/checkout?orderId=${order.orderId}`);
  const sheet = page.getByTestId("checkout-sheet");
  await expect(sheet).toBeVisible();
  const box = async (target: Locator) => (await target.boundingBox())!;
  const footer = page.getByRole("contentinfo");
  for (const height of [800, 1080]) {
    await page.setViewportSize({ width: 1280, height });
    const header = await box(
      page.getByRole("navigation", { name: "Điều hướng chính" }),
    );
    const capsule = await box(page.getByTestId("hold-capsule"));
    const card = await box(sheet);
    const foot = await box(footer);
    const above = capsule.y - (header.y + header.height);
    const below = foot.y - (card.y + card.height);
    expect(Math.abs(above - below), `${height}px`).toBeLessThanOrEqual(8);
    expect(Math.abs(foot.y + foot.height - height)).toBeLessThanOrEqual(1);
  }
  // Điện thoại: liên kết xếp liền hàng nên chân trang thấp hơn.
  await page.setViewportSize({ width: 390, height: 844 });
  expect((await box(footer)).height).toBeLessThanOrEqual(280);
  // Màn thấp: nội dung chạy từ trên xuống, không bị đẩy khỏi trang.
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const header = await box(
    page.getByRole("navigation", { name: "Điều hướng chính" }),
  );
  expect(
    (await box(page.getByTestId("hold-capsule"))).y,
  ).toBeGreaterThanOrEqual(header.y + header.height);
  await cancelHold(page);
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

test("Kết quả đang chờ: một thẻ giữa màn, một nút chính, vừa màn 320px", async ({
  page,
  request,
}) => {
  const order = await hold(request);
  await loginBrowser(page);
  await page.route(`${api}/buyer/orders/${order.orderId}`, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.data.event.title = "Đại nhạc hội ".repeat(10).trim();
    body.data.finalAmount = 99_000_000_000;
    await route.fulfill({ response, json: body });
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/checkout/result?orderId=${order.orderId}`);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText(
    "Đang chờ xác nhận thanh toán",
  );
  await expect(main.getByRole("button")).toHaveText(["Kiểm tra lại"]);
  await expect(main.getByRole("link")).toHaveText(["Xem đơn hàng"]);
  await expect(main.getByRole("link")).toHaveAttribute(
    "href",
    `/buyer/orders/${order.orderId}`,
  );
  await expect(main.getByRole("img")).toBeVisible();
  await expect(main).toContainText("Tổng cộng");
  const card = (await page.getByTestId("result-card").boundingBox())!;
  const link = (await main.getByRole("link").boundingBox())!;
  const header = (await page
    .getByRole("navigation", { name: "Điều hướng chính" })
    .boundingBox())!;
  const above = card.y - (header.y + header.height);
  const below = 800 - (link.y + link.height);
  expect(Math.abs(above - below)).toBeLessThanOrEqual(16);
  expect(Math.abs(card.x + card.width / 2 - 640)).toBeLessThanOrEqual(1);
  expect(card.width).toBeLessThanOrEqual(480);
  await page.setViewportSize({ width: 320, height: 640 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
  // Lỗi khi kiểm tra lại: đơn vẫn hiện, kèm thông báo.
  await page.unroute(`${api}/buyer/orders/${order.orderId}`);
  await page.route(`${api}/buyer/orders/${order.orderId}`, (route) =>
    route.fulfill({
      status: 500,
      json: { success: false, error: { code: "E", message: "Lỗi tạm thời" } },
    }),
  );
  await main.getByRole("button", { name: "Kiểm tra lại" }).click();
  await expect(
    main.getByRole("alert").filter({ hasText: "Lỗi tạm thời" }),
  ).toBeVisible();
  await expect(main.getByRole("heading", { level: 1 })).toHaveText(
    "Đang chờ xác nhận thanh toán",
  );
  await expect(main).toContainText(order.orderCode);
});

test("Kết quả không tải được thì thử lại được; thiếu mã đơn thì chỉ về Vé của tôi", async ({
  page,
  request,
}) => {
  const order = await hold(request);
  await loginBrowser(page);
  const url = `${api}/buyer/orders/${order.orderId}`;
  await page.route(url, (route) => route.abort("connectionrefused"));
  await page.goto(`/checkout/result?orderId=${order.orderId}`);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText(
    "Chưa kiểm tra được thanh toán",
  );
  await expect(main.getByRole("alert")).toHaveText(
    "Không kết nối được. Kiểm tra mạng rồi thử lại.",
  );
  await page.unroute(url);
  await main.getByRole("button", { name: "Kiểm tra lại" }).click();
  await expect(main.getByRole("heading", { level: 1 })).toHaveText(
    "Đang chờ xác nhận thanh toán",
  );
  await page.goto("/checkout/result?orderId=khong-hop-le");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText(
    "Chưa xác định được đơn",
  );
  await expect(
    main.getByRole("link", { name: "Xem Vé của tôi" }),
  ).toHaveAttribute("href", "/buyer/orders");
});

test("Quay về từ VNPay không chớp thông báo không xác định được đơn", async ({
  page,
  request,
}) => {
  const order = await hold(request);
  await loginBrowser(page);
  await page.addInitScript((orderId) => {
    sessionStorage.setItem(
      "tickethub:payment-return",
      JSON.stringify({ orderId, transactionRef: "REF1" }),
    );
    new MutationObserver(() => {
      if (document.body?.textContent?.includes("Chưa xác định được đơn"))
        sessionStorage.setItem("flashed", "1");
    }).observe(document, { childList: true, subtree: true });
  }, order.orderId);
  await page.goto("/checkout/vnpay-return?vnp_TxnRef=REF1");
  await expect(
    page.getByRole("heading", { name: "Đang chờ xác nhận thanh toán" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem("flashed")),
  ).toBeNull();
});

test("Chưa đăng nhập mở kết quả đơn thì được đưa tới đăng nhập", async ({
  page,
  request,
}) => {
  const order = await hold(request);
  await page.goto(`/checkout/result?orderId=${order.orderId}`);
  await expect(page).toHaveURL(/\/auth\?redirect=.*checkout%2Fresult/);
});

test("Kiểm tra lại giữ nguyên tiêu điểm và thẻ trong lúc đang hỏi", async ({
  page,
  request,
}) => {
  const order = await hold(request);
  await loginBrowser(page);
  const url = `${api}/buyer/orders/${order.orderId}`;
  let release = () => {};
  const held = () => new Promise<void>((done) => (release = done));
  // Chưa trả lời: trang đang kiểm tra phải có tiêu đề.
  let gate = held();
  await page.route(url, async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto(`/checkout/result?orderId=${order.orderId}`);
  const main = page.getByRole("main");
  const title = main.getByRole("heading", { level: 1 });
  await expect(title).toHaveText("Đang kiểm tra thanh toán");
  release();
  await expect(title).toHaveText("Đang chờ xác nhận thanh toán");
  // Đang hỏi lại: nút vẫn giữ tiêu điểm.
  gate = held();
  const retry = main.getByRole("button", { name: "Kiểm tra lại" });
  await retry.focus();
  await page.keyboard.press("Enter");
  await expect(retry).toHaveAttribute("aria-disabled", "true");
  await expect(retry).toBeFocused();
  release();
  await expect(retry).toHaveAttribute("aria-disabled", "false");
  await expect(retry).toBeFocused();
  await page.unroute(url);
  // Thử lại từ trạng thái lỗi không đổi cả thẻ thành vòng quay.
  await page.route(url, (route) => route.abort("connectionrefused"));
  await page.goto(`/checkout/result?orderId=${order.orderId}`);
  await expect(title).toHaveText("Chưa kiểm tra được thanh toán");
  await page.unroute(url);
  gate = held();
  await page.route(url, async (route) => {
    await gate;
    await route.continue();
  });
  await retry.focus();
  await page.keyboard.press("Enter");
  await expect(retry).toHaveAttribute("aria-disabled", "true");
  await expect(title).toHaveText("Chưa kiểm tra được thanh toán");
  await expect(retry).toBeFocused();
  release();
  await expect(title).toHaveText("Đang chờ xác nhận thanh toán");
});

test("Đơn hết hạn vẫn được hỏi lại; hoàn tiền bị từ chối thì nói rõ", async ({
  page,
  request,
}) => {
  const order = await hold(request);
  await loginBrowser(page);
  let status = "EXPIRED";
  let refunds: unknown[] = [];
  await page.route(`${api}/buyer/orders/${order.orderId}`, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.data.status = status;
    body.data.refunds = refunds;
    await route.fulfill({ response, json: body });
  });
  await page.goto(`/checkout/result?orderId=${order.orderId}`);
  const main = page.getByRole("main");
  const title = main.getByRole("heading", { level: 1 });
  await expect(title).toHaveText("Thanh toán không thành công");
  await expect(main).toContainText("đừng thanh toán lại");
  await expect(
    main.getByRole("button", { name: "Kiểm tra lại" }),
  ).toBeVisible();
  // VNPay xác nhận muộn: trang tự cập nhật, người mua không phải bấm.
  status = "PAYMENT_EXPIRED_REFUND_PENDING";
  await expect(title).toHaveText("Đang hoàn tiền", { timeout: 20_000 });
  refunds = [
    {
      id: "6f1d2c3b-4a5e-4f60-8b71-9c0d1e2f3a4b",
      amount: 100,
      status: "FAILED",
      reason: null,
      createdAt: "2026-11-28T00:00:00.000Z",
    },
  ];
  await page.reload();
  await expect(title).toHaveText("Chưa hoàn được tiền");
  await expect(main).toContainText("Hoàn tiền chưa thực hiện được");
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
  await page.getByRole("link", { name: "Xem vé" }).click();
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
