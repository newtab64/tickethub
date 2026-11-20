import { z } from "zod";

// Đối chiếu PR newtab64/tickethub#49, commit ff96dd3.
const numeric = z
  .union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])
  .transform(Number)
  .refine(Number.isFinite);
const count = numeric.refine((n) => Number.isInteger(n) && n >= 0);
// Raw SQL của PR49 trả PostgreSQL timestamp; Drizzle select trả ISO.
const timestamp = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    if (
      !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?[+-]\d{2}(:?\d{2})?$/.test(
        value,
      )
    )
      return value;
    return value
      .replace(" ", "T")
      .replace(/([+-]\d{2})$/, "$1:00")
      .replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  },
  z.iso.datetime({ offset: true }),
);
export const PageMetaSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  hasMore: z.boolean(),
});
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    success: z.literal(true),
    data: z.array(item),
    meta: PageMetaSchema,
  });
}
export const OperationEventSchema = z.object({
  id: z.uuid(),
  title: z.string(),
});
export const StaffSchema = z.object({
  id: z.uuid(),
  fullName: z.string(),
  email: z.email(),
  phone: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "LOCKED"]),
  createdAt: timestamp.optional(),
});
export const AssignmentSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  fullName: z.string(),
  email: z.email(),
  status: z.enum(["ACTIVE", "LOCKED"]),
  gateId: z.uuid().nullable(),
});
export const GateSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  locationDesc: z.string().nullable().optional(),
});
export const CreateStaffSchema = z
  .object({
    fullName: z.string().trim().min(1, "Vui lòng nhập họ tên").max(150),
    email: z
      .email("Email không hợp lệ")
      .max(255)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(12, "Mật khẩu cần ít nhất 12 ký tự").max(128),
    phone: z.string().trim().max(20).optional(),
  })
  .strict();
export const CreateGateSchema = z
  .object({
    name: z.string().trim().min(1, "Vui lòng nhập tên cổng").max(100),
    locationDesc: z.string().trim().max(255).optional(),
  })
  .strict();
export const ReportSummarySchema = z.object({
  total_sold_tickets: count,
  total_checked_in_tickets: count,
  total_cancelled_tickets: count,
  gross_revenue: numeric,
  paid_revenue: numeric,
  total_refunded_amount: numeric,
  net_revenue: numeric,
  checkin_percentage: numeric,
  refreshed_at: timestamp,
});
export const ReportSaleSchema = z.object({
  ticket_type_id: z.uuid(),
  ticket_type_name: z.string(),
  sale_date: z.iso.date(),
  total_sold_tickets: count,
  total_checked_in_tickets: count,
  paid_revenue: numeric,
});
export const ReportSchema = z.object({
  summary: ReportSummarySchema.nullable(),
  sales: z.array(ReportSaleSchema),
  analytics: z
    .object({
      cancellationPercentage: numeric,
      fees: z.object({
        status: z.literal("NOT_CONFIGURED"),
        platformFee: z.null(),
        gatewayFee: z.null(),
        netPayout: z.null(),
      }),
    })
    .nullable(),
  period: z.object({
    fromDate: z.iso.date().nullable(),
    toDate: z.iso.date().nullable(),
    ticketTypeId: z.uuid().nullable(),
    voucherCode: z.string().nullable(),
    timezone: z.literal("Asia/Ho_Chi_Minh"),
    refundBasis: z.literal("COMPLETION_DATE"),
    ticketBasis: z.literal("PAYMENT_DATE_CURRENT_STATUS"),
  }),
});
export const CheckinSummarySchema = z.object({
  eventId: z.uuid(),
  generatedAt: timestamp,
  suggestedPollIntervalMs: z.number().positive(),
  summary: z.object({
    validTickets: count,
    checkedInTickets: count,
    remainingTickets: count,
    successfulAttempts: count,
    rejectedAttempts: count,
    checkinPercentage: numeric,
  }),
  gates: z.array(
    z.object({
      gateId: z.uuid().nullable(),
      gateName: z.string().nullable(),
      successfulAttempts: count,
      rejectedAttempts: count,
      checkedInTickets: count,
      activeAssignedStaff: count,
      lastScanAt: timestamp.nullable(),
    }),
  ),
  timelineLast24Hours: z.array(
    z.object({
      hour: timestamp,
      successfulAttempts: count,
      rejectedAttempts: count,
    }),
  ),
});
export const CheckinLogSchema = z.object({
  id: z.uuid(),
  gateId: z.uuid().nullable(),
  staffId: z.uuid(),
  method: z.string(),
  outcome: z.string(),
  reason: z.string().nullable(),
  errorCode: z.string().nullable(),
  checkedInAt: timestamp,
});
export const ExportJobSchema = z.object({
  id: z.uuid(),
  status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED", "EXPIRED"]),
  format: z.enum(["csv", "xlsx"]),
  createdAt: timestamp,
  expiresAt: timestamp.nullable().optional(),
  fromDate: z.iso.date().nullable(),
  toDate: z.iso.date().nullable(),
  ticketTypeId: z.uuid().nullable(),
  voucherCode: z.string().nullable(),
  downloadUrl: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
});
export type Staff = z.infer<typeof StaffSchema>;
export type CreateStaff = z.infer<typeof CreateStaffSchema>;
export type Report = z.infer<typeof ReportSchema>;
export type ExportJob = z.infer<typeof ExportJobSchema>;
export type PageMeta = z.infer<typeof PageMetaSchema>;
export interface ReportPeriod {
  from: string;
  to: string;
  ticketTypeId?: string;
  voucherCode?: string;
}
export function validatePeriod(period: ReportPeriod): string | null {
  if (
    !z.iso.date().safeParse(period.from).success ||
    !z.iso.date().safeParse(period.to).success
  )
    return "Vui lòng chọn đủ ngày bắt đầu và kết thúc";
  if (period.from > period.to)
    return "Ngày kết thúc phải từ ngày bắt đầu trở đi";
  if (period.ticketTypeId && !z.uuid().safeParse(period.ticketTypeId).success)
    return "Hạng vé không hợp lệ";
  if ((period.voucherCode?.trim().length || 0) > 50)
    return "Mã voucher tối đa 50 ký tự";
  return null;
}
export function periodInput(period: ReportPeriod) {
  const error = validatePeriod(period);
  if (error) throw new Error(error);
  return {
    fromDate: period.from,
    toDate: period.to,
    ...(period.ticketTypeId ? { ticketTypeId: period.ticketTypeId } : {}),
    ...(period.voucherCode?.trim()
      ? { voucherCode: period.voucherCode.trim().toUpperCase() }
      : {}),
  };
}
export function periodQuery(period: ReportPeriod) {
  return new URLSearchParams(periodInput(period)).toString();
}
export function checkInPercent(checkedIn: number, sold: number): number {
  return sold > 0 ? Math.min(100, Math.max(0, (checkedIn / sold) * 100)) : 0;
}
export function salesGroups(sales: Report["sales"]) {
  const daily = new Map<string, number>();
  const types = new Map<
    string,
    { id: string; name: string; sold: number; revenue: number }
  >();
  for (const sale of sales) {
    daily.set(
      sale.sale_date,
      (daily.get(sale.sale_date) || 0) + sale.paid_revenue,
    );
    const group = types.get(sale.ticket_type_id) || {
      id: sale.ticket_type_id,
      name: sale.ticket_type_name,
      sold: 0,
      revenue: 0,
    };
    group.sold += sale.total_sold_tickets;
    group.revenue += sale.paid_revenue;
    types.set(group.id, group);
  }
  return {
    daily: [...daily]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({ date, revenue })),
    ticketTypes: [...types.values()],
  };
}
export function initialPeriod(): ReportPeriod {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return { from: `${today.slice(0, 7)}-01`, to: today };
}
export function isExportPending(status: ExportJob["status"]) {
  return status === "PENDING" || status === "PROCESSING";
}
