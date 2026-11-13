import { test, expect, type Page } from "@playwright/test";

// Fixture hợp đồng BE2, chỉ kiểm thử frontend; xác thực dùng API đăng nhập thật.
test.use({
  launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {},
});
const eventId = "10000000-0000-4000-8000-000000000001";
const secondId = "10000000-0000-4000-8000-000000000002";
const gateId = "20000000-0000-4000-8000-000000000001";
const secondGate = "20000000-0000-4000-8000-000000000002";
const staffId = "30000000-0000-4000-8000-000000000001";
const jobId = "40000000-0000-4000-8000-000000000001";
const updatedAt = "2026-11-06T10:00:00+07:00";
const base = "**/api/v1/organizer/events";
const report = {
  updatedAt,
  revenue: 1800000,
  ticketsSold: 3,
  checkedIn: 2,
  daily: [{ date: "2026-11-06", revenue: 1800000 }],
  ticketTypes: [{ name: "VIP", sold: 3, revenue: 1800000 }],
};
let session: { accessToken: string; user: object };

test.beforeAll(async ({ request }) => {
  const response = await request.post(
    "http://localhost:4000/api/v1/auth/login",
    { data: { email: "organizer@tickethub.vn", password: "Password123!" } },
  );
  expect(response.ok()).toBeTruthy();
  session = (await response.json()).data;
});

test.beforeEach(async ({ page, context }) => {
  await context.addCookies([
    {
      name: "accessToken",
      value: session.accessToken,
      url: "http://localhost:3000",
    },
  ]);
  await page.addInitScript(
    (user) => localStorage.setItem("tickethub_user", JSON.stringify(user)),
    session.user,
  );
  await page.route(base, (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          items: [
            { id: eventId, title: "Sự kiện W05" },
            { id: secondId, title: "Sự kiện thứ hai" },
          ],
        },
      },
    }),
  );
});

async function staffFixture(page: Page) {
  let staff = {
    id: staffId,
    fullName: "Nhân viên A",
    email: "staff@example.com",
    status: "ACTIVE",
    gateId,
  };
  const changes: object[] = [];
  await page.route(`${base}/${eventId}/staff`, async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      changes.push(body);
      staff = {
        ...staff,
        fullName: body.fullName,
        email: body.email,
        gateId: body.gateId,
      };
      await route.fulfill({
        status: 201,
        json: { success: true, data: staff },
      });
    } else
      await route.fulfill({
        json: {
          success: true,
          data: {
            items: [staff],
            gates: [
              { id: gateId, name: "Cổng A" },
              { id: secondGate, name: "Cổng B" },
            ],
          },
        },
      });
  });
  await page.route(`${base}/${eventId}/staff/${staffId}`, async (route) => {
    const patch = route.request().postDataJSON();
    changes.push(patch);
    staff = { ...staff, ...patch };
    await route.fulfill({ json: { success: true, data: staff } });
  });
  return changes;
}

test("W05 nhân viên: tạo, gán cổng, xác nhận khóa và mở khóa", async ({
  page,
}) => {
  const changes = await staffFixture(page);
  await page.goto("/organizer/staff");
  await expect(page.getByText("Nhân viên A", { exact: true })).toBeVisible();
  await page.getByLabel("Cổng của Nhân viên A").selectOption(secondGate);
  await expect.poll(() => changes.length).toBe(1);
  expect(changes[0]).toEqual({ gateId: secondGate });
  await page
    .getByRole("button", { name: "Khóa tài khoản", exact: true })
    .click();
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  expect(changes).toHaveLength(1);
  await page
    .getByRole("button", { name: "Khóa tài khoản", exact: true })
    .click();
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(page.getByText("Đã khóa", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mở khóa", exact: true }).click();
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(page.getByText("Đang hoạt động", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Thêm nhân viên", exact: true })
    .click();
  await page.getByLabel("Họ tên", { exact: true }).fill("Nhân viên mới");
  await page.getByLabel("Email", { exact: true }).fill("new@example.com");
  await page.getByLabel("Mật khẩu ban đầu").fill("LongPassword123!");
  await page.getByLabel("Cổng được phân công").selectOption(gateId);
  await page.getByRole("button", { name: "Tạo và phân công" }).click();
  await expect(
    page.getByText("Đã tạo tài khoản và phân công nhân viên."),
  ).toBeVisible();
  expect(changes.at(-1)).toMatchObject({
    fullName: "Nhân viên mới",
    email: "new@example.com",
    gateId,
  });
});

test("W05 API thiếu không hiển thị số liệu hoặc thành công giả", async ({
  page,
}) => {
  await page.route(`${base}/${eventId}/reports?*`, (route) =>
    route.fulfill({ status: 404, json: { success: false } }),
  );
  await page.goto("/organizer/dashboard");
  await expect(
    page.getByRole("alert").filter({ hasText: "Chức năng chưa" }),
  ).toContainText("Chức năng chưa được máy chủ hỗ trợ");
  await expect(page.getByText("Doanh thu thuần", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Xuất báo cáo", exact: true }),
  ).toHaveCount(0);
});

test("W05 báo cáo: lọc ngày, số liệu và xuất Excel nền", async ({ page }) => {
  const periods: string[] = [];
  await page.route(`${base}/${eventId}/reports?*`, (route) => {
    periods.push(route.request().url());
    return route.fulfill({ json: { success: true, data: report } });
  });
  let exportBody: object | null = null;
  await page.route(`${base}/${eventId}/report-exports`, (route) => {
    exportBody = route.request().postDataJSON();
    expect(route.request().headers()["idempotency-key"]).toBeTruthy();
    return route.fulfill({
      status: 202,
      json: {
        success: true,
        data: { id: jobId, status: "QUEUED", downloadUrl: null, error: null },
      },
    });
  });
  let reads = 0;
  await page.route(`${base}/${eventId}/report-exports/${jobId}`, (route) => {
    reads++;
    return route.fulfill({
      json: {
        success: true,
        data: {
          id: jobId,
          status: reads === 1 ? "PROCESSING" : "COMPLETED",
          downloadUrl:
            reads === 1 ? null : "https://files.example.com/report.xlsx",
          error: null,
        },
      },
    });
  });
  await page.goto(`/organizer/events/${eventId}/stats`);
  await expect(page.getByText("66.7%", { exact: true })).toBeVisible();
  await page.getByLabel("Từ ngày", { exact: true }).fill("2026-11-01");
  await page.getByLabel("Đến ngày", { exact: true }).fill("2026-11-06");
  await page.getByRole("button", { name: "Áp dụng", exact: true }).click();
  await expect(
    page.getByText("Kỳ báo cáo: 2026-11-01 đến 2026-11-06"),
  ).toBeVisible();
  expect(new URL(periods.at(-1)!).searchParams.get("timezone")).toBe(
    "Asia/Ho_Chi_Minh",
  );
  await page.getByLabel("Định dạng báo cáo").selectOption("xlsx");
  await page.getByRole("button", { name: "Xuất báo cáo", exact: true }).click();
  await expect(page.getByText("Đang tạo tệp", { exact: true })).toBeVisible();
  await page.getByLabel("Đến ngày", { exact: true }).fill("2026-11-07");
  await page.getByRole("button", { name: "Áp dụng", exact: true }).click();
  await expect(
    page.getByText("Yêu cầu XLSX: 2026-11-01 đến 2026-11-06"),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Tải báo cáo" })).toHaveAttribute(
    "href",
    "https://files.example.com/report.xlsx",
  );
  expect(exportBody).toEqual({
    from: "2026-11-01",
    to: "2026-11-06",
    timezone: "Asia/Ho_Chi_Minh",
    format: "xlsx",
  });
});

test("W05 đổi sự kiện không giữ số liệu sự kiện trước", async ({ page }) => {
  await page.route(`${base}/${eventId}/reports?*`, (route) =>
    route.fulfill({ json: { success: true, data: report } }),
  );
  await page.route(`${base}/${secondId}/reports?*`, (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          ...report,
          revenue: 0,
          ticketsSold: 0,
          checkedIn: 0,
          daily: [],
          ticketTypes: [],
        },
      },
    }),
  );
  await page.goto("/organizer/dashboard");
  await expect(page.getByText("66.7%", { exact: true })).toBeVisible();
  await page.getByLabel("Sự kiện", { exact: true }).selectOption(secondId);
  await expect(page.getByText("0.0%", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Chưa có doanh thu trong khoảng thời gian này."),
  ).toBeVisible();
  await expect(page.getByText("66.7%", { exact: true })).toHaveCount(0);
});

test("W05 giám sát: tạm dừng, làm mới và cảnh báo dữ liệu cũ", async ({
  page,
}) => {
  let fail = false;
  await page.route(`${base}/${eventId}/gate-monitor`, (route) =>
    fail
      ? route.fulfill({
          status: 503,
          json: {
            success: false,
            error: { code: "UNAVAILABLE", message: "Máy chủ tạm ngừng" },
          },
        })
      : route.fulfill({
          json: {
            success: true,
            data: {
              updatedAt,
              gates: [
                { id: gateId, name: "Cổng A", checkedIn: 2, staffCount: 1 },
              ],
              recent: [],
            },
          },
        }),
  );
  await page.goto("/organizer/gate-monitor");
  await expect(page.getByText("Cổng A", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Tạm dừng", exact: true }).click();
  await expect(
    page.getByText("Đã tạm dừng cập nhật", { exact: true }),
  ).toBeVisible();
  fail = true;
  await page.getByRole("button", { name: "Làm mới", exact: true }).click();
  await expect(
    page.getByText("Mất kết nối cập nhật. Dữ liệu bên dưới có thể đã cũ."),
  ).toBeVisible();
  await expect(page.getByText("Cổng A", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("alert").filter({ hasText: "Máy chủ tạm ngừng" }),
  ).toContainText("Máy chủ tạm ngừng");
});

test("W05 mobile: tìm nhân viên, không tràn màn hình", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await staffFixture(page);
  await page.goto("/organizer/staff");
  await page.getByLabel("Tìm nhân viên").fill("không tồn tại");
  await expect(
    page.getByText("Không tìm thấy nhân viên phù hợp."),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("W05 trạng thái rỗng và kiểm soát quyền khi chưa đăng nhập", async ({
  page,
  context,
}) => {
  await page.route(base, (route) =>
    route.fulfill({ json: { success: true, data: { items: [] } } }),
  );
  await page.goto("/organizer/staff");
  await expect(
    page.getByText("Bạn chưa có sự kiện.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Thêm nhân viên", exact: true }),
  ).toHaveCount(0);
  await context.clearCookies();
  await page.goto("/organizer/dashboard");
  await expect(page).toHaveURL(/\/auth\?redirect=/);
});

test("W05 tạo tài khoản lỗi không báo thành công", async ({ page }) => {
  await staffFixture(page);
  await page.route(`${base}/${eventId}/staff`, (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 409,
          json: {
            success: false,
            error: { code: "EMAIL_EXISTS", message: "Email đã tồn tại" },
          },
        })
      : route.fallback(),
  );
  await page.goto("/organizer/staff");
  await page
    .getByRole("button", { name: "Thêm nhân viên", exact: true })
    .click();
  await page.getByLabel("Họ tên", { exact: true }).fill("Nhân viên trùng");
  await page.getByLabel("Email", { exact: true }).fill("staff@example.com");
  await page.getByLabel("Mật khẩu ban đầu").fill("LongPassword123!");
  await page.getByLabel("Cổng được phân công").selectOption(gateId);
  await page.getByRole("button", { name: "Tạo và phân công" }).click();
  await expect(
    page.getByText("Email đã tồn tại", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Đã tạo tài khoản và phân công nhân viên."),
  ).toHaveCount(0);
  await expect(page.getByLabel("Họ tên", { exact: true })).toHaveValue(
    "Nhân viên trùng",
  );
});

test("W05 xuất CSV thất bại và không tự gửi lại yêu cầu", async ({ page }) => {
  await page.route(`${base}/${eventId}/reports?*`, (route) =>
    route.fulfill({ json: { success: true, data: report } }),
  );
  let creates = 0;
  await page.route(`${base}/${eventId}/report-exports`, (route) => {
    creates++;
    expect(route.request().postDataJSON().format).toBe("csv");
    return route.fulfill({
      status: 202,
      json: {
        success: true,
        data: { id: jobId, status: "QUEUED", downloadUrl: null, error: null },
      },
    });
  });
  await page.route(`${base}/${eventId}/report-exports/${jobId}`, (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          id: jobId,
          status: "FAILED",
          downloadUrl: null,
          error: "EXPORT_FAILED",
        },
      },
    }),
  );
  await page.goto("/organizer/dashboard");
  await page.getByRole("button", { name: "Xuất báo cáo", exact: true }).click();
  await expect(
    page.getByText("Xuất báo cáo thất bại. Bạn có thể tạo yêu cầu mới."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Tải báo cáo" })).toHaveCount(0);
  expect(creates).toBe(1);
});

test("W05 giám sát tự cập nhật theo chu kỳ", async ({ page }) => {
  let reads = 0;
  let advanced = false;
  await page.route(`${base}/${eventId}/gate-monitor`, (route) => {
    reads++;
    return route.fulfill({
      json: {
        success: true,
        data: {
          updatedAt,
          gates: [
            {
              id: gateId,
              name: "Cổng A",
              checkedIn: advanced ? 3 : 2,
              staffCount: 1,
            },
          ],
          recent: [],
        },
      },
    });
  });
  await page.goto("/organizer/gate-monitor");
  await expect(page.getByText("2", { exact: true })).toBeVisible();
  const initialReads = reads;
  advanced = true;
  await expect(page.getByText("3", { exact: true })).toBeVisible({
    timeout: 10000,
  });
  expect(reads).toBeGreaterThan(initialReads);
});
