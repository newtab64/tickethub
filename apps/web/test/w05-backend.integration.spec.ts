import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
// Không mock response. Chỉ chạy với API PR49 + report worker và DB test riêng.
const API = process.env.W05_API_URL || "http://localhost:4000/api/v1";
test.use({
  launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {},
});
test.skip(
  process.env.W05_LIVE_TESTS !== "1",
  "Đặt W05_LIVE_TESTS=1 khi đã bật backend PR49, worker và DB kiểm thử riêng.",
);
let session: { accessToken: string; user: object };
let eventId: string;
test.beforeAll(async ({ request }) => {
  const login = await request.post(`${API}/auth/login`, {
    data: { email: "organizer@tickethub.vn", password: "Password123!" },
  });
  expect(login.ok()).toBeTruthy();
  session = (await login.json()).data;
  const events = await request.get(`${API}/organizer/events`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  expect(events.ok()).toBeTruthy();
  eventId = (await events.json()).data.items[0].id;
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
});
test("PR49 thật: tạo tài khoản/cổng, phân công và khóa qua frontend", async ({
  page,
  request,
}) => {
  const suffix = Date.now();
  const name = `FE1 Live ${suffix}`;
  const email = `fe1-live-${suffix}@example.com`;
  const gateName = `FE1 Gate ${suffix}`;
  await page.goto("/organizer/staff");
  await page.getByLabel("Sự kiện", { exact: true }).selectOption(eventId);
  await page
    .getByRole("button", { name: "Thêm nhân viên", exact: true })
    .click();
  await page.getByLabel("Họ tên", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu ban đầu").fill("LongPassword123!");
  await page
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await expect(
    page.getByText(
      "Đã tạo tài khoản. Chọn cổng ở danh sách để phân công vào sự kiện.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Thêm cổng", exact: true }).click();
  await page.getByLabel("Tên cổng", { exact: true }).fill(gateName);
  await page.getByRole("button", { name: "Tạo cổng", exact: true }).click();
  await expect(page.getByText("Đã tạo cổng vào.")).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: email });
  await row.getByRole("combobox").selectOption({ label: gateName });
  await expect(page.getByText("Đã cập nhật phân công sự kiện.")).toBeVisible();
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const assigned = await request.get(
    `${API}/organizer/events/${eventId}/staff?limit=100&page=1`,
    { headers },
  );
  expect(assigned.ok()).toBeTruthy();
  const assignment = (await assigned.json()).data.find(
    (a: { email: string }) => a.email === email,
  );
  expect(assignment.userId).toBeTruthy();
  expect(assignment.gateId).toBeTruthy();
  await row
    .getByRole("button", { name: "Khóa tài khoản", exact: true })
    .click();
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(row.getByText("Đã khóa", { exact: true })).toBeVisible();
  const lockedLogin = await request.post(`${API}/auth/login`, {
    data: { email, password: "LongPassword123!" },
  });
  expect([401, 403]).toContain(lockedLogin.status());
  // Bỏ phân công fixture, giữ tài khoản khóa vì API không hỗ trợ xóa tài khoản/cổng.
  const removed = await request.delete(
    `${API}/organizer/events/${eventId}/staff/${assignment.userId}`,
    { headers },
  );
  expect(removed.ok()).toBeTruthy();
});
test("PR49 thật: báo cáo, check-in trực tiếp, CSV/XLSX nền và tải có xác thực", async ({
  page,
  request,
}) => {
  test.setTimeout(60000);
  await page.goto(`/organizer/events/${eventId}/stats`);
  await expect(
    page.getByText("Tiền thu sau hoàn", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Tiền thực thu theo ngày" }),
  ).toBeVisible();
  for (const format of ["csv", "xlsx"]) {
    await page
      .getByLabel("Định dạng báo cáo", { exact: true })
      .selectOption(format);
    await page
      .getByRole("button", { name: "Xuất báo cáo", exact: true })
      .click();
    await expect(
      page.getByText("Đã gửi yêu cầu xuất báo cáo. Trạng thái sẽ tự cập nhật."),
    ).toBeVisible();
    // Lịch sử mới nhất ở đầu; worker thật tạo tệp và polling thật chuyển COMPLETED.
    const row = page
      .getByRole("table", { name: "Lịch sử xuất báo cáo" })
      .getByRole("row")
      .nth(1);
    await expect(row.getByRole("cell").first()).toContainText(
      format.toUpperCase(),
    );
    await expect(
      row.getByRole("button", { name: "Tải báo cáo", exact: true }),
    ).toBeEnabled({ timeout: 20000 });
    const pending = page.waitForEvent("download");
    await row.getByRole("button", { name: "Tải báo cáo", exact: true }).click();
    const file = await pending;
    expect(file.suggestedFilename().endsWith(`.${format}`)).toBeTruthy();
    const bytes = await readFile((await file.path())!);
    expect(bytes.length).toBeGreaterThan(20);
    if (format === "xlsx") expect(bytes.subarray(0, 2).toString()).toBe("PK");
    else expect(bytes.toString("utf8")).toContain(",");
  }
  await page.reload();
  await expect(
    page.getByRole("table", { name: "Lịch sử xuất báo cáo" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tải báo cáo", exact: true }).first(),
  ).toBeEnabled();
  await page.goto("/organizer/gate-monitor");
  await page.getByLabel("Sự kiện", { exact: true }).selectOption(eventId);
  await expect(page.getByText("Vé đã vào cổng", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Lịch sử quét cổng" }),
  ).toBeVisible();
  const response = await request.get(
    `${API}/organizer/events/${eventId}/checkins/summary`,
    { headers: { Authorization: `Bearer ${session.accessToken}` } },
  );
  expect(response.ok()).toBeTruthy();
  const data = (await response.json()).data;
  expect(data.summary.checkedInTickets).toBeGreaterThanOrEqual(0);
});
