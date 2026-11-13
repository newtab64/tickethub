import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkInPercent,
  validatePeriod,
  periodQuery,
  safeDownloadUrl,
  ReportSchema,
  ExportJobSchema,
  CreateStaffSchema,
} from "../src/features/organizer/domain/operations.ts";

test("W05: khoảng ngày Việt Nam hợp lệ và giữ nguyên hai đầu", () => {
  assert.equal(validatePeriod({ from: "2026-11-06", to: "2026-11-06" }), null);
  assert.ok(validatePeriod({ from: "2026-11-07", to: "2026-11-06" }));
  assert.ok(validatePeriod({ from: "2026-02-30", to: "2026-11-06" }));
  assert.ok(validatePeriod({ from: "", to: "2026-11-06" }));
  const query = new URLSearchParams(
    periodQuery({ from: "2026-11-01", to: "2026-11-06" }),
  );
  assert.equal(query.get("timezone"), "Asia/Ho_Chi_Minh");
  assert.equal(query.get("to"), "2026-11-06");
});

test("W05: check-in xử lý mẫu số 0 và giới hạn phần trăm", () => {
  assert.equal(checkInPercent(0, 0), 0);
  assert.equal(checkInPercent(1, 4), 25);
  assert.equal(checkInPercent(8, 4), 100);
});

test("W05: không mở URL tải nguy hiểm hoặc chứa credential", () => {
  for (const url of [
    null,
    "javascript:alert(1)",
    "data:text/html,test",
    "http://files.test/a",
    "https://user:pass@files.test/a",
    "/file.csv",
  ])
    assert.equal(safeDownloadUrl(url), null);
  assert.equal(
    safeDownloadUrl("https://files.test/a.csv?signature=abc"),
    "https://files.test/a.csv?signature=abc",
  );
});

test("W05: từ chối báo cáo sai và job hoàn tất thiếu tệp", () => {
  const report = {
    updatedAt: "2026-11-06T10:00:00+07:00",
    revenue: 0,
    ticketsSold: 0,
    checkedIn: 0,
    daily: [],
    ticketTypes: [],
  };
  assert.ok(ReportSchema.safeParse(report).success);
  assert.equal(
    ReportSchema.safeParse({ ...report, checkedIn: 1 }).success,
    false,
  );
  assert.equal(
    ReportSchema.safeParse({ ...report, revenue: -1 }).success,
    false,
  );
  assert.equal(
    ExportJobSchema.safeParse({
      id: "10000000-0000-4000-8000-000000000001",
      status: "COMPLETED",
      downloadUrl: null,
      error: null,
    }).success,
    false,
  );
});

test("W05: tạo nhân viên yêu cầu email, cổng và mật khẩu đủ mạnh", () => {
  const input = {
    fullName: "Nhân viên",
    email: "staff@example.com",
    password: "LongPassword123!",
    gateId: "10000000-0000-4000-8000-000000000001",
  };
  assert.ok(CreateStaffSchema.safeParse(input).success);
  for (const patch of [
    { email: "staff" },
    { gateId: "" },
    { password: "short" },
    { fullName: " " },
  ])
    assert.equal(
      CreateStaffSchema.safeParse({ ...input, ...patch }).success,
      false,
    );
});
