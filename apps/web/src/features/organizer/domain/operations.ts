import { z } from "zod";

// Hợp đồng đề xuất W05, chờ BE2 triển khai. Không suy diễn số liệu từ tồn kho công khai.
const count = z.number().int().nonnegative();
const money = z.number().finite().nonnegative();
export const OperationEventSchema = z.object({
  id: z.uuid(),
  title: z.string(),
});
export const StaffSchema = z.object({
  id: z.uuid(),
  fullName: z.string(),
  email: z.email(),
  status: z.enum(["ACTIVE", "LOCKED"]),
  gateId: z.uuid().nullable(),
});
export const GateSchema = z.object({ id: z.uuid(), name: z.string() });
export const StaffListSchema = z.object({
  items: z.array(StaffSchema),
  gates: z.array(GateSchema),
});
export const CreateStaffSchema = z.object({
  fullName: z.string().trim().min(2, "Họ tên cần ít nhất 2 ký tự").max(100),
  email: z.email("Email không hợp lệ"),
  password: z.string().min(12, "Mật khẩu cần ít nhất 12 ký tự").max(128),
  gateId: z.uuid("Vui lòng chọn cổng"),
});
export const ReportSchema = z
  .object({
    updatedAt: z.iso.datetime({ offset: true }),
    revenue: money,
    ticketsSold: count,
    checkedIn: count,
    daily: z.array(z.object({ date: z.iso.date(), revenue: money })),
    ticketTypes: z.array(
      z.object({ name: z.string(), sold: count, revenue: money }),
    ),
  })
  .refine(
    (r) => r.checkedIn <= r.ticketsSold,
    "Số vé đã vào cổng vượt số vé đã bán",
  );
export const GateMonitorSchema = z.object({
  updatedAt: z.iso.datetime({ offset: true }),
  gates: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      checkedIn: count,
      staffCount: count,
    }),
  ),
  recent: z.array(
    z.object({
      id: z.uuid(),
      gateName: z.string(),
      staffName: z.string(),
      checkedInAt: z.iso.datetime({ offset: true }),
    }),
  ),
});
export const ExportJobSchema = z
  .object({
    id: z.uuid(),
    status: z.enum(["QUEUED", "PROCESSING", "COMPLETED", "FAILED"]),
    downloadUrl: z.url().nullable(),
    error: z.string().nullable(),
  })
  .refine(
    (job) => job.status !== "COMPLETED" || Boolean(job.downloadUrl),
    "Thiếu liên kết tải báo cáo",
  );

export type OperationEvent = z.infer<typeof OperationEventSchema>;
export type Staff = z.infer<typeof StaffSchema>;
export type StaffList = z.infer<typeof StaffListSchema>;
export type CreateStaff = z.infer<typeof CreateStaffSchema>;
export type Report = z.infer<typeof ReportSchema>;
export type GateMonitor = z.infer<typeof GateMonitorSchema>;
export type ExportJob = z.infer<typeof ExportJobSchema>;
export interface ReportPeriod {
  from: string;
  to: string;
}

export function validatePeriod(period: ReportPeriod): string | null {
  if (
    !z.iso.date().safeParse(period.from).success ||
    !z.iso.date().safeParse(period.to).success
  )
    return "Vui lòng chọn đủ ngày bắt đầu và kết thúc";
  if (period.from > period.to)
    return "Ngày kết thúc phải từ ngày bắt đầu trở đi";
  return null;
}

export function periodQuery(period: ReportPeriod): string {
  const error = validatePeriod(period);
  if (error) throw new Error(error);
  return new URLSearchParams({
    ...period,
    timezone: "Asia/Ho_Chi_Minh",
  }).toString();
}

export function checkInPercent(checkedIn: number, sold: number): number {
  return sold > 0 ? Math.min(100, Math.max(0, (checkedIn / sold) * 100)) : 0;
}

export function safeDownloadUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
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
