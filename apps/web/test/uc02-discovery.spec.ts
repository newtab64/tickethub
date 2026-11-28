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
  // Khi đang tải, React có thêm một bản sao ẩn của nội dung được stream.
  const city = page.getByTestId("city-filter").filter({ visible: true });
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

test("Ô tìm kiếm trên header gợi ý sự kiện thật", async ({ page }) => {
  await page.goto("/faq");
  await page.getByRole("button", { name: "Tìm kiếm sự kiện" }).click();
  await page.getByRole("search").getByRole("textbox").fill("ghibli");
  await expect(
    page.getByRole("search").getByRole("link", { name: /Ghibli/ }),
  ).toHaveAttribute("href", "/events/giao-huong-ghibli-ha-noi");
});

test("Ô tìm kiếm báo lỗi khi API không phản hồi", async ({ page }) => {
  await page.route("**/api/v1/events?*", (route) =>
    route.abort("connectionrefused"),
  );
  await page.goto("/faq");
  await page.getByRole("button", { name: "Tìm kiếm sự kiện" }).click();
  await page.getByRole("search").getByRole("textbox").fill("ghibli");
  await expect(page.getByRole("search")).toContainText(
    "Không tải được sự kiện.",
  );
});

test("Header đánh dấu thể loại của sự kiện đang xem", async ({ page }) => {
  await page.goto("/events/a-o-show");
  await expect(
    page
      .getByRole("banner")
      .getByRole("link", { name: "Sân khấu", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("Vé của tôi dẫn tới đơn hàng thật, không dựng vé từ URL", async ({
  page,
  request,
}) => {
  const api = process.env.W04_API_URL || "http://localhost:4000/api/v1";
  const login = await request.post(`${api}/auth/login`, {
    data: { email: "buyer@tickethub.vn", password: "Password123!" },
  });
  const { data } = await login.json();
  await page.context().addCookies([
    {
      name: "accessToken",
      value: data.accessToken,
      url: "http://localhost:3000",
    },
  ]);
  await page.goto("/my-tickets?order=ORD-GIA-1&zone=VIP");
  await expect(page).toHaveURL(/\/buyer\/orders$/);
  await expect(page.getByText("ORD-GIA-1")).toHaveCount(0);
});

test("Lọc thể loại tại chỗ, không gọi lại máy chủ", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const pageLoads: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/") pageLoads.push(url.href);
  });
  await page.getByRole("button", { name: "Thể thao", exact: true }).click();
  await expect(page).toHaveURL(/category=SPORT/);
  await expect(
    page.getByRole("heading", { level: 3, name: /VBA Finals/ }).first(),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(pageLoads).toEqual([]);
});

test("Ảnh hỏng thì liên kết ảnh của thẻ vẫn có tên", async ({ page }) => {
  await page.route("**/_next/image**", (route) => route.abort());
  await page.goto("/");
  const trending = page.getByRole("region", { name: /Sự kiện thịnh hành/ });
  await trending.scrollIntoViewIfNeeded();
  const title = (await trending
    .getByRole("heading", { level: 3 })
    .first()
    .textContent())!;
  await expect(trending.locator("img")).toHaveCount(0);
  await expect(trending.getByRole("link").first()).toHaveAccessibleName(title);
});

test("Header khách: ba thể loại, mời đăng nhập, không chặn nội dung", async ({
  page,
}) => {
  await page.goto("/faq");
  const header = page.getByRole("banner").filter({ visible: true });
  await expect(
    header.getByRole("link", { name: /^(Hòa nhạc|Thể thao|Sân khấu)$/ }),
  ).toHaveText(["Hòa nhạc", "Thể thao", "Sân khấu"]);
  await expect(header.getByRole("link", { name: "Đăng nhập" })).toBeVisible();
  await expect(header.getByRole("link", { name: "Vé của tôi" })).toHaveCount(0);
  // Vùng hai bên viên thuốc phải bấm xuyên xuống trang.
  const blocked = await page.evaluate(
    () => !!document.elementFromPoint(4, 40)?.closest("header"),
  );
  expect(blocked).toBe(false);
});

async function signIn(
  page: import("@playwright/test").Page,
  email: string,
): Promise<void> {
  const api = process.env.W04_API_URL || "http://localhost:4000/api/v1";
  const login = await page.request.post(`${api}/auth/login`, {
    data: { email, password: "Password123!" },
  });
  const { data } = await login.json();
  await page.context().addCookies([
    {
      name: "accessToken",
      value: data.accessToken,
      url: "http://localhost:3000",
    },
  ]);
  await page.addInitScript(
    (user) => localStorage.setItem("tickethub_user", JSON.stringify(user)),
    data.user,
  );
}

test("Màn 320px: nút trên header và phân trang nằm trọn trong màn hình", async ({
  page,
}) => {
  await signIn(page, "buyer@tickethub.vn");
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Điều hướng chính" });
  const account = nav.getByRole("button", { name: "Tài khoản" });
  await expect(account).toBeVisible();
  const right = async (target: typeof nav) => {
    const box = (await target.boundingBox())!;
    return box.x + box.width;
  };
  expect(await right(account)).toBeLessThanOrEqual(await right(nav));

  await page.goto("/buyer/orders");
  const next = page.getByRole("button", { name: "Trang sau" });
  await expect(next).toBeVisible();
  expect(await right(next as typeof nav)).toBeLessThanOrEqual(320);
});

test("Bộ lọc của Ban tổ chức không tràn và không cắt nhãn", async ({
  page,
}) => {
  await signIn(page, "organizer@tickethub.vn");
  await page.goto("/organizer/events");
  const boxes = page.getByRole("combobox");
  for (const width of [1024, 1100, 1280]) {
    await page.setViewportSize({ width, height: 720 });
    await expect(boxes.first()).toBeVisible();
    const overflow = await boxes.evaluateAll((items) =>
      items.map(
        (item) =>
          item.getBoundingClientRect().right -
          item.parentElement!.parentElement!.parentElement!.getBoundingClientRect()
            .right,
      ),
    );
    expect(Math.max(...overflow), String(width)).toBeLessThanOrEqual(0.5);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
      String(width),
    ).toBeLessThanOrEqual(0);
  }
  const cut = await boxes.evaluateAll((items) =>
    items.flatMap((item) =>
      [...item.querySelectorAll(".truncate")]
        .filter((label) => label.scrollWidth > label.clientWidth)
        .map((label) => label.textContent),
    ),
  );
  expect(cut).toEqual([]);
});

test("Tạo sự kiện trên màn 320px: ô ngày giờ đọc được", async ({ page }) => {
  await signIn(page, "organizer@tickethub.vn");
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/organizer/events/new");
  const labels = page.locator("button .truncate").filter({
    hasText: /^(dd\/mm\/yyyy|HH:mm)$/,
  });
  await expect(labels.first()).toBeVisible();
  expect(
    await labels.evaluateAll(
      (items) =>
        items.filter((item) => item.scrollWidth > item.clientWidth).length,
    ),
  ).toBe(0);
});

test("Hết hạn access token nhưng còn phiên thì header vẫn là người mua", async ({
  page,
}) => {
  const api = process.env.W04_API_URL || "http://localhost:4000/api/v1";
  // Đăng nhập chỉ giữ cookie refresh, như sau 15 phút.
  const login = await page.request.post(`${api}/auth/login`, {
    data: { email: "buyer@tickethub.vn", password: "Password123!" },
  });
  const { data } = await login.json();
  await page.addInitScript(
    (user) => localStorage.setItem("tickethub_user", JSON.stringify(user)),
    data.user,
  );
  await page.context().clearCookies({ name: /^access_?[tT]oken$/ });
  await page.goto("/faq");
  const header = page.getByRole("banner").filter({ visible: true });
  await expect(header.getByRole("button", { name: "Tài khoản" })).toBeVisible();
  await expect(header.getByRole("link", { name: "Vé của tôi" })).toBeVisible();
});

test("Đăng xuất thu hồi phiên ở máy chủ", async ({ page }) => {
  const api = process.env.W04_API_URL || "http://localhost:4000/api/v1";
  await signIn(page, "buyer@tickethub.vn");
  await page.goto("/faq");
  const header = page.getByRole("banner").filter({ visible: true });
  await header.getByRole("button", { name: "Tài khoản" }).click();
  await header.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/auth/);
  const refresh = await page.request.post(`${api}/auth/refresh`);
  expect(refresh.ok()).toBe(false);
});
