import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
// Response fixture bám mã PR49; test chạy với xác thực thật nhưng không thay dữ liệu BE.
test.use({
  launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {},
});
const API = process.env.W05_API_URL || "http://localhost:4000/api/v1";
const eventId = "10000000-0000-4000-8000-000000000001",
  secondId = "10000000-0000-4000-8000-000000000002";
const gateId = "20000000-0000-4000-8000-000000000001",
  secondGate = "20000000-0000-4000-8000-000000000002";
const staffId = "30000000-0000-4000-8000-000000000001",
  assignmentId = "31000000-0000-4000-8000-000000000001",
  jobId = "40000000-0000-4000-8000-000000000001";
const stamp = "2026-11-06T10:00:00+07:00",
  base = "**/api/v1/organizer/events",
  staffBase = "**/api/v1/organizer/staff",
  exportBase = `${base}/${eventId}/reports/exports`;
const meta = { page: 1, limit: 20, hasMore: false };
const staff = {
  id: staffId,
  fullName: "Nhân viên A",
  email: "staff@example.com",
  phone: null,
  status: "ACTIVE",
  createdAt: stamp,
};
const report = {
  summary: {
    event_id: eventId,
    organizer_id: staffId,
    title: "Sự kiện W05",
    total_sold_tickets: "3",
    total_checked_in_tickets: "2",
    total_cancelled_tickets: "1",
    gross_revenue: "2100000",
    paid_revenue: "1800000",
    total_refunded_amount: "200000",
    net_revenue: "1600000",
    checkin_percentage: "66.67",
    refreshed_at: stamp,
  },
  sales: [
    {
      ticket_type_id: gateId,
      ticket_type_name: "VIP",
      sale_date: "2026-11-06",
      total_sold_tickets: "3",
      total_checked_in_tickets: "2",
      paid_revenue: "1800000",
      refreshed_at: stamp,
    },
  ],
  analytics: {
    cancellationPercentage: 25,
    fees: {
      status: "NOT_CONFIGURED",
      platformFee: null,
      gatewayFee: null,
      netPayout: null,
    },
  },
  period: {
    fromDate: "2026-11-01",
    toDate: "2026-11-06",
    ticketTypeId: null,
    voucherCode: null,
    timezone: "Asia/Ho_Chi_Minh",
    refundBasis: "COMPLETION_DATE",
    ticketBasis: "PAYMENT_DATE_CURRENT_STATUS",
  },
};
const job = {
  id: jobId,
  status: "PENDING",
  format: "xlsx",
  createdAt: stamp,
  expiresAt: null as string | null,
  fromDate: "2026-11-01",
  toDate: "2026-11-06",
  ticketTypeId: null,
  voucherCode: null,
  errorMessage: null,
  downloadUrl: null as string | null,
};
let session: { accessToken: string; user: object };
test.beforeAll(async ({ request }) => {
  const r = await request.post(`${API}/auth/login`, {
    data: { email: "organizer@tickethub.vn", password: "Password123!" },
  });
  expect(r.ok()).toBeTruthy();
  session = (await r.json()).data;
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
  await page.route(base, (r) =>
    r.fulfill({
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
  await page.route(`${base}/${eventId}`, (r) =>
    r.fulfill({
      json: {
        success: true,
        data: { id: eventId, ticketTypes: [{ id: gateId, name: "VIP" }] },
      },
    }),
  );
  await page.route(`${exportBase}?*`, (r) =>
    r.fulfill({ json: { success: true, data: [], meta } }),
  );
});
async function staffFixture(page: Page) {
  let account = { ...staff };
  let assigned: string | null = gateId;
  const changes: { path: string; body: unknown }[] = [];
  await page.route(`${staffBase}?*`, (r) =>
    r.fulfill({ json: { success: true, data: [account], meta } }),
  );
  await page.route(staffBase, (r) => {
    const body = r.request().postDataJSON();
    changes.push({ path: "create", body });
    account = { ...account, ...body };
    return r.fulfill({ status: 201, json: { success: true, data: account } });
  });
  await page.route(`${staffBase}/${staffId}`, (r) => {
    const body = r.request().postDataJSON();
    changes.push({ path: "update", body });
    account = { ...account, ...body };
    return r.fulfill({ json: { success: true, data: account } });
  });
  await page.route(`${base}/${eventId}/gates?*`, (r) => {
    const p = Number(new URL(r.request().url()).searchParams.get("page"));
    return r.fulfill({
      json: {
        success: true,
        data: [
          {
            id: p === 1 ? gateId : secondGate,
            name: p === 1 ? "Cổng A" : "Cổng B",
            locationDesc: null,
          },
        ],
        meta: { page: p, limit: 100, hasMore: p === 1 },
      },
    });
  });
  await page.route(`${base}/${eventId}/staff?*`, (r) =>
    r.fulfill({
      json: {
        success: true,
        data: assigned
          ? [
              {
                id: assignmentId,
                userId: staffId,
                fullName: account.fullName,
                email: account.email,
                status: account.status,
                gateId: assigned,
              },
            ]
          : [],
        meta: { ...meta, limit: 100 },
      },
    }),
  );
  await page.route(`${base}/${eventId}/staff`, (r) => {
    const body = r.request().postDataJSON();
    assigned = body.gateId;
    changes.push({ path: "assign", body });
    return r.fulfill({
      json: {
        success: true,
        data: {
          id: assignmentId,
          eventId,
          ...body,
          staffRole: "GATE_SCANNER",
          createdAt: stamp,
        },
      },
    });
  });
  await page.route(`${base}/${eventId}/staff/${staffId}`, (r) => {
    assigned = null;
    changes.push({ path: "unassign", body: null });
    return r.fulfill({ json: { success: true, data: { removed: true } } });
  });
  return changes;
}
async function reportFixture(page: Page) {
  await page.route(`${base}/${eventId}/reports?*`, (r) =>
    r.fulfill({ json: { success: true, data: report } }),
  );
}

test("PR49 nhân viên: phân trang cổng, gán bằng userId, bỏ phân công, khóa và tạo tài khoản riêng", async ({
  page,
}) => {
  const changes = await staffFixture(page);
  await page.goto("/organizer/staff");
  await expect(page.getByText("Nhân viên A", { exact: true })).toBeVisible();
  await page.getByLabel("Cổng của Nhân viên A").selectOption(secondGate);
  await expect.poll(() => changes.length).toBe(1);
  expect(changes[0]).toEqual({
    path: "assign",
    body: { userId: staffId, gateId: secondGate },
  });
  await page.getByLabel("Cổng của Nhân viên A").selectOption("");
  await expect.poll(() => changes.length).toBe(2);
  expect(changes[1].path).toBe("unassign");
  await page
    .getByRole("button", { name: "Khóa tài khoản", exact: true })
    .click();
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  expect(changes).toHaveLength(2);
  await page
    .getByRole("button", { name: "Khóa tài khoản", exact: true })
    .click();
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(page.getByText("Đã khóa", { exact: true })).toBeVisible();
  expect(changes[2]).toEqual({ path: "update", body: { status: "LOCKED" } });
  await page.getByRole("button", { name: "Mở khóa", exact: true }).click();
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(page.getByText("Đang hoạt động", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Thêm nhân viên", exact: true })
    .click();
  await page.getByLabel("Họ tên", { exact: true }).fill("Nhân viên mới");
  await page.getByLabel("Email", { exact: true }).fill("new@example.com");
  await page.getByLabel("Mật khẩu ban đầu").fill("LongPassword123!");
  await page
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await expect(
    page.getByText(
      "Đã tạo tài khoản. Chọn cổng ở danh sách để phân công vào sự kiện.",
    ),
  ).toBeVisible();
  expect(changes.at(-1)).toEqual({
    path: "create",
    body: {
      fullName: "Nhân viên mới",
      email: "new@example.com",
      password: "LongPassword123!",
      phone: "",
    },
  });
});
test("PR49 bộ lọc strict, tiền dạng chuỗi, hoàn âm không bị gán thành 0", async ({
  page,
}) => {
  const queries: string[] = [];
  await page.route(`${base}/${eventId}/reports?*`, (r) => {
    queries.push(r.request().url());
    return r.fulfill({
      json: {
        success: true,
        data: {
          ...report,
          summary: { ...report.summary, net_revenue: "-500000" },
        },
      },
    });
  });
  await page.goto(`/organizer/events/${eventId}/stats`);
  await expect(page.getByText("66.67%", { exact: true })).toBeVisible();
  await expect(page.getByText(/-500\.000/)).toBeVisible();
  await page.getByLabel("Từ ngày", { exact: true }).fill("2026-11-01");
  await page.getByLabel("Đến ngày", { exact: true }).fill("2026-11-06");
  await page.getByLabel("Hạng vé", { exact: true }).selectOption(gateId);
  await page.getByLabel("Mã voucher", { exact: true }).fill(" summer ");
  await page.getByRole("button", { name: "Áp dụng", exact: true }).click();
  await expect
    .poll(() => new URL(queries.at(-1)!).searchParams.get("voucherCode"))
    .toBe("SUMMER");
  expect(Object.fromEntries(new URL(queries.at(-1)!).searchParams)).toEqual({
    fromDate: "2026-11-01",
    toDate: "2026-11-06",
    ticketTypeId: gateId,
    voucherCode: "SUMMER",
  });
  await expect(
    page.getByRole("heading", { name: "Tiền thực thu theo ngày" }),
  ).toBeVisible();
});
test("PR49 xuất XLSX nền, khôi phục sau F5, tải bằng Bearer qua endpoint tương đối", async ({
  page,
}) => {
  await reportFixture(page);
  let jobs: (typeof job)[] = [];
  let complete = false;
  let body: object | null = null;
  await page.route(`${exportBase}?*`, (r) =>
    r.fulfill({
      json: {
        success: true,
        data: jobs.map((j) => ({
          ...j,
          status: complete ? "COMPLETED" : "PROCESSING",
          downloadUrl: complete
            ? `/api/v1/organizer/events/${eventId}/reports/exports/${jobId}/download`
            : null,
        })),
        meta,
      },
    }),
  );
  await page.route(exportBase, (r) => {
    body = r.request().postDataJSON();
    jobs = [{ ...job, ...body }];
    return r.fulfill({ status: 202, json: { success: true, data: jobs[0] } });
  });
  await page.route(`${exportBase}/${jobId}`, (r) =>
    r.fulfill({
      json: {
        success: true,
        data: {
          ...job,
          status: "COMPLETED",
          downloadUrl: `/api/v1/organizer/events/${eventId}/reports/exports/${jobId}/download`,
        },
      },
    }),
  );
  await page.route(`${exportBase}/${jobId}/download`, (r) => {
    expect(r.request().headers().authorization).toBe(
      `Bearer ${session.accessToken}`,
    );
    return r.fulfill({
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      body: Buffer.from("PK-test-workbook"),
    });
  });
  await page.goto("/organizer/dashboard");
  await page.getByLabel("Từ ngày", { exact: true }).fill("2026-11-01");
  await page.getByLabel("Đến ngày", { exact: true }).fill("2026-11-06");
  await page.getByRole("button", { name: "Áp dụng", exact: true }).click();
  await page
    .getByLabel("Định dạng báo cáo", { exact: true })
    .selectOption("xlsx");
  await page.getByRole("button", { name: "Xuất báo cáo", exact: true }).click();
  await expect(page.getByText("Đang tạo tệp", { exact: true })).toBeVisible();
  expect(body).toEqual({
    fromDate: "2026-11-01",
    toDate: "2026-11-06",
    format: "xlsx",
  });
  await page.reload();
  await expect(page.getByText("Đang tạo tệp", { exact: true })).toBeVisible();
  complete = true;
  await expect(
    page.getByRole("button", { name: "Tải báo cáo", exact: true }),
  ).toBeEnabled({ timeout: 10000 });
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tải báo cáo", exact: true }).click();
  const file = await pending;
  expect(file.suggestedFilename()).toBe(`event-report-${jobId}.xlsx`);
  expect((await readFile((await file.path())!)).toString()).toBe(
    "PK-test-workbook",
  );
});
test("PR49 API thiếu không giả số liệu", async ({ page }) => {
  await page.route(`${base}/${eventId}/reports?*`, (r) =>
    r.fulfill({ status: 404, json: { statusCode: 404, message: "Not Found" } }),
  );
  await page.goto("/organizer/dashboard");
  await expect(
    page.getByRole("alert").filter({ hasText: "Chức năng hoặc dữ liệu" }),
  ).toBeVisible();
  await expect(
    page.getByText("Tiền thu sau hoàn", { exact: true }),
  ).toHaveCount(0);
});
test("PR49 giám sát gồm cả lượt từ chối, tự poll và cảnh báo snapshot cũ", async ({
  page,
}) => {
  let advanced = false,
    fail = false;
  await page.route(`${base}/${eventId}/checkins/summary`, (r) =>
    fail
      ? r.fulfill({ status: 503, json: { message: "Máy chủ tạm ngừng" } })
      : r.fulfill({
          json: {
            success: true,
            data: {
              eventId,
              generatedAt: stamp,
              suggestedPollIntervalMs: 5000,
              summary: {
                validTickets: 4,
                checkedInTickets: advanced ? 3 : 2,
                remainingTickets: advanced ? 1 : 2,
                successfulAttempts: 3,
                rejectedAttempts: 1,
                checkinPercentage: advanced ? 75 : 50,
              },
              gates: [
                {
                  gateId,
                  gateName: "Cổng A",
                  checkedInTickets: 2,
                  activeAssignedStaff: 1,
                  successfulAttempts: 3,
                  rejectedAttempts: 1,
                  lastScanAt: stamp,
                },
              ],
              timelineLast24Hours: [],
            },
          },
        }),
  );
  await page.route(`${base}/${eventId}/checkins?*`, (r) =>
    r.fulfill({
      json: {
        success: true,
        data: [
          {
            id: jobId,
            gateId,
            staffId,
            method: "QR",
            outcome: "REJECTED",
            reason: null,
            errorCode: "TICKET_ALREADY_USED",
            checkedInAt: stamp,
          },
        ],
        meta,
      },
    }),
  );
  await page.goto("/organizer/gate-monitor");
  await expect(
    page.getByText("TICKET_ALREADY_USED", { exact: true }),
  ).toBeVisible();
  advanced = true;
  await expect(
    page.getByText("75.00% / 4 vé còn hiệu lực", { exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "Tạm dừng", exact: true }).click();
  await expect(
    page.getByText("Đã tạm dừng cập nhật", { exact: true }),
  ).toBeVisible();
  fail = true;
  await page.getByRole("button", { name: "Làm mới", exact: true }).click();
  await expect(
    page.getByText("Mất kết nối cập nhật. Dữ liệu bên dưới có thể đã cũ."),
  ).toBeVisible();
  await expect(page.getByText("Cổng A", { exact: true }).first()).toBeVisible();
});
test("PR49 phân trang tài khoản và mobile", async ({ page }) => {
  await staffFixture(page);
  await page.route(`${staffBase}?*`, (r) => {
    const p = Number(new URL(r.request().url()).searchParams.get("page"));
    return r.fulfill({
      json: {
        success: true,
        data: [
          { ...staff, fullName: p === 1 ? "Trang đầu" : "Nhân viên trang hai" },
        ],
        meta: { page: p, limit: 20, hasMore: p === 1 },
      },
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/organizer/staff");
  await page.getByRole("button", { name: "Trang sau", exact: true }).click();
  await expect(
    page.getByText("Nhân viên trang hai", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Tìm trên trang nhân viên hiện tại").fill("không có");
  await expect(
    page.getByText("Không tìm thấy nhân viên phù hợp trên trang này."),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
test("PR49 tạo tài khoản lỗi Nest không báo thành công", async ({ page }) => {
  await staffFixture(page);
  await page.route(staffBase, (r) =>
    r.fulfill({
      status: 409,
      json: {
        statusCode: 409,
        message: "EMAIL_ALREADY_EXISTS",
        error: "Conflict",
      },
    }),
  );
  await page.goto("/organizer/staff");
  await page
    .getByRole("button", { name: "Thêm nhân viên", exact: true })
    .click();
  await page.getByLabel("Họ tên", { exact: true }).fill("A");
  await page.getByLabel("Email", { exact: true }).fill("a@example.com");
  await page.getByLabel("Mật khẩu ban đầu").fill("LongPassword123!");
  await page
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await expect(
    page.getByText("Email đã tồn tại. Hãy dùng tài khoản khác."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tạo tài khoản", exact: true }),
  ).toBeEnabled();
});
test("PR49 job EXPIRED và lỗi 410 không tải tệp giả", async ({ page }) => {
  await reportFixture(page);
  await page.route(`${exportBase}?*`, (r) =>
    r.fulfill({
      json: { success: true, data: [{ ...job, status: "COMPLETED" }], meta },
    }),
  );
  await page.route(`${exportBase}/${jobId}`, (r) =>
    r.fulfill({
      json: { success: true, data: { ...job, status: "COMPLETED" } },
    }),
  );
  await page.route(`${exportBase}/${jobId}/download`, (r) =>
    r.fulfill({ status: 410, json: { message: "EXPORT_EXPIRED" } }),
  );
  await page.goto("/organizer/dashboard");
  await page.getByRole("button", { name: "Tải báo cáo", exact: true }).click();
  await expect(
    page.getByText("Tệp báo cáo đã hết hạn. Vui lòng tạo báo cáo mới."),
  ).toBeVisible();
});
test("PR49 danh sách rỗng và redirect khi chưa đăng nhập", async ({
  page,
  context,
}) => {
  await page.route(base, (r) =>
    r.fulfill({ json: { success: true, data: { items: [] } } }),
  );
  await page.goto("/organizer/staff");
  await expect(
    page.getByText("Bạn chưa có sự kiện.", { exact: false }),
  ).toBeVisible();
  await context.clearCookies();
  await page.goto("/organizer/dashboard");
  await expect(page).toHaveURL(/\/auth\?redirect=/);
});
test("PR49 tải tệp refresh token một lần khi 401", async ({ page }) => {
  await reportFixture(page);
  await page.route(`${exportBase}?*`, (r) =>
    r.fulfill({
      json: { success: true, data: [{ ...job, status: "COMPLETED" }], meta },
    }),
  );
  await page.route(`${exportBase}/${jobId}`, (r) =>
    r.fulfill({
      json: { success: true, data: { ...job, status: "COMPLETED" } },
    }),
  );
  let calls = 0,
    refresh = 0;
  await page.route("**/api/v1/auth/refresh", (r) => {
    refresh++;
    return r.fulfill({
      json: { success: true, data: { accessToken: "test-refreshed-token" } },
    });
  });
  await page.route(`${exportBase}/${jobId}/download`, (r) => {
    calls++;
    if (calls === 1)
      return r.fulfill({ status: 401, json: { message: "Unauthorized" } });
    expect(r.request().headers().authorization).toBe(
      "Bearer test-refreshed-token",
    );
    return r.fulfill({ body: "protected-by-refresh", contentType: "text/csv" });
  });
  await page.goto("/organizer/dashboard");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tải báo cáo", exact: true }).click();
  await pending;
  expect(calls).toBe(2);
  expect(refresh).toBe(1);
});
