import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validatePeriod,
  periodInput,
  periodQuery,
  ReportSchema,
  StaffSchema,
  AssignmentSchema,
  ExportJobSchema,
  CreateStaffSchema,
  salesGroups,
  pageSchema,
  isExportPending,
} from "../src/features/organizer/domain/operations.ts";
const id = "10000000-0000-4000-8000-000000000001";
const time = "2026-11-06T10:00:00+07:00";
const raw = {
  summary: {
    total_sold_tickets: "0",
    total_checked_in_tickets: "0",
    total_cancelled_tickets: "2",
    gross_revenue: "0.00",
    paid_revenue: "0.00",
    total_refunded_amount: "500000.00",
    net_revenue: "-500000.00",
    checkin_percentage: "0",
    refreshed_at: time,
  },
  sales: [],
  analytics: {
    cancellationPercentage: 100,
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
test("PR49: bộ lọc strict chỉ gửi fromDate/toDate, không timezone/from/to", () => {
  assert.equal(validatePeriod({ from: "2026-11-06", to: "2026-11-06" }), null);
  for (const period of [
    { from: "", to: "2026-11-06" },
    { from: "2026-02-30", to: "2026-11-06" },
    { from: "2026-11-07", to: "2026-11-06" },
  ])
    assert.ok(validatePeriod(period));
  assert.deepEqual(
    periodInput({
      from: "2026-11-01",
      to: "2026-11-06",
      ticketTypeId: id,
      voucherCode: " summer ",
    }),
    {
      fromDate: "2026-11-01",
      toDate: "2026-11-06",
      ticketTypeId: id,
      voucherCode: "SUMMER",
    },
  );
  const q = new URLSearchParams(
    periodQuery({ from: "2026-11-01", to: "2026-11-06" }),
  );
  assert.equal(q.get("timezone"), null);
  assert.equal(q.get("fromDate"), "2026-11-01");
});
test("PR49: số tiền SQL dạng chuỗi và kỳ hoàn tiền âm hợp lệ", () => {
  const pgTime = ReportSchema.parse({
    ...raw,
    summary: { ...raw.summary, refreshed_at: "2026-11-13 06:39:59.498245+00" },
  });
  assert.equal(
    pgTime.summary?.refreshed_at,
    "2026-11-13T06:39:59.498245+00:00",
  );
  const report = ReportSchema.parse(raw);
  assert.equal(report.summary?.net_revenue, -500000);
  assert.equal(report.summary?.total_sold_tickets, 0);
  assert.equal(
    ReportSchema.safeParse({
      ...raw,
      summary: { ...raw.summary, net_revenue: "unknown" },
    }).success,
    false,
  );
  assert.ok(
    ReportSchema.safeParse({ ...raw, summary: null, analytics: null }).success,
  );
});
test("PR49: gộp sales theo ID hạng và ngày, không gắn nhãn tiền thu là tiền sau hoàn", () => {
  const sale = {
    ticket_type_id: id,
    ticket_type_name: "VIP",
    sale_date: "2026-11-06",
    total_sold_tickets: 2,
    total_checked_in_tickets: 1,
    paid_revenue: 200,
  };
  const groups = salesGroups([
    sale,
    { ...sale, sale_date: "2026-11-05", paid_revenue: 100 },
  ]);
  assert.deepEqual(groups.daily, [
    { date: "2026-11-05", revenue: 100 },
    { date: "2026-11-06", revenue: 200 },
  ]);
  assert.deepEqual(groups.ticketTypes, [
    { id, name: "VIP", sold: 4, revenue: 300 },
  ]);
});
test("PR49: tạo tài khoản tách phân công cổng, đúng giới hạn BE", () => {
  const input = {
    fullName: " A ",
    email: "Staff@example.com",
    password: "LongPassword123!",
    phone: "0901234567",
  };
  const result = CreateStaffSchema.parse(input);
  assert.equal(result.fullName, "A");
  assert.equal(result.email, "staff@example.com");
  assert.equal(
    CreateStaffSchema.safeParse({ ...input, gateId: id }).success,
    false,
  );
  assert.equal(
    CreateStaffSchema.safeParse({ ...input, password: "short" }).success,
    false,
  );
});
test("PR49: userId của phân công khác id dòng, giữ meta hasMore", () => {
  const staff = {
    id,
    fullName: "A",
    email: "a@example.com",
    status: "ACTIVE",
    phone: null,
    createdAt: time,
  };
  const row = AssignmentSchema.parse({
    ...staff,
    id: "20000000-0000-4000-8000-000000000001",
    userId: id,
    gateId: null,
  });
  assert.equal(row.userId, id);
  const result = pageSchema(StaffSchema).parse({
    success: true,
    data: [staff],
    meta: { page: 2, limit: 20, hasMore: true },
  });
  assert.equal(result.meta.page, 2);
  assert.ok(result.meta.hasMore);
});
test("PR49: PENDING/EXPIRED và URL tải tương đối là hợp đồng hợp lệ", () => {
  const job = {
    id,
    status: "PENDING",
    format: "csv",
    createdAt: time,
    fromDate: null,
    toDate: null,
    ticketTypeId: null,
    voucherCode: null,
  };
  assert.ok(isExportPending(ExportJobSchema.parse(job).status));
  assert.equal(isExportPending("EXPIRED"), false);
  assert.ok(
    ExportJobSchema.safeParse({
      ...job,
      status: "COMPLETED",
      downloadUrl: `/api/v1/organizer/events/${id}/reports/exports/${id}/download`,
      expiresAt: time,
      errorMessage: null,
    }).success,
  );
  assert.equal(
    ExportJobSchema.safeParse({ ...job, status: "QUEUED" }).success,
    false,
  );
});
