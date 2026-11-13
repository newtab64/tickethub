import { z } from "zod";
import { apiClient, apiEnvelope, apiBlob, ApiError } from "@/shared/api/client";
import {
  OperationEventSchema,
  StaffSchema,
  GateSchema,
  AssignmentSchema,
  ReportSchema,
  CheckinSummarySchema,
  CheckinLogSchema,
  ExportJobSchema,
  CreateStaffSchema,
  CreateGateSchema,
  pageSchema,
  periodQuery,
  periodInput,
  type CreateStaff,
  type ReportPeriod,
} from "../domain/operations";
const eventPath = (id: string) => `/organizer/events/${z.uuid().parse(id)}`;
async function page<T extends z.ZodType>(
  path: string,
  schema: T,
  current = 1,
  limit = 20,
  signal?: AbortSignal,
) {
  return pageSchema(schema).parse(
    await apiEnvelope<unknown>(`${path}?page=${current}&limit=${limit}`, {
      signal,
    }),
  );
}
async function all<T extends z.ZodType>(
  path: string,
  schema: T,
  signal?: AbortSignal,
): Promise<z.infer<T>[]> {
  const items: z.infer<T>[] = [];
  for (let current = 1; current <= 10000; current++) {
    const result = await page(path, schema, current, 100, signal);
    items.push(...result.data);
    if (!result.meta.hasMore) return items;
  }
  throw new Error("Danh sách quá lớn. Vui lòng liên hệ hỗ trợ.");
}
export const organizerOperationsApi = {
  async events(signal?: AbortSignal) {
    return z
      .object({ items: z.array(OperationEventSchema) })
      .parse(await apiClient<unknown>("/organizer/events", { signal })).items;
  },
  async staff(eventId: string, current = 1, signal?: AbortSignal) {
    const [accounts, gates, assignments] = await Promise.all([
      page("/organizer/staff", StaffSchema, current, 20, signal),
      all(`${eventPath(eventId)}/gates`, GateSchema, signal),
      all(`${eventPath(eventId)}/staff`, AssignmentSchema, signal),
    ]);
    return {
      items: accounts.data.map((staff) => ({
        ...staff,
        gateId: assignments.find((a) => a.userId === staff.id)?.gateId || null,
      })),
      meta: accounts.meta,
      gates,
    };
  },
  async createStaff(input: CreateStaff) {
    return StaffSchema.parse(
      await apiClient<unknown>("/organizer/staff", {
        method: "POST",
        body: JSON.stringify(CreateStaffSchema.parse(input)),
      }),
    );
  },
  async updateStaff(staffId: string, patch: { status: "ACTIVE" | "LOCKED" }) {
    return StaffSchema.parse(
      await apiClient<unknown>(`/organizer/staff/${z.uuid().parse(staffId)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    );
  },
  async assign(eventId: string, userId: string, gateId: string) {
    return z
      .object({ id: z.uuid(), userId: z.uuid(), gateId: z.uuid().nullable() })
      .parse(
        await apiClient<unknown>(`${eventPath(eventId)}/staff`, {
          method: "POST",
          body: JSON.stringify({
            userId: z.uuid().parse(userId),
            gateId: z.uuid().parse(gateId),
          }),
        }),
      );
  },
  async unassign(eventId: string, userId: string) {
    return apiClient(`${eventPath(eventId)}/staff/${z.uuid().parse(userId)}`, {
      method: "DELETE",
    });
  },
  async createGate(eventId: string, input: z.infer<typeof CreateGateSchema>) {
    return GateSchema.parse(
      await apiClient<unknown>(`${eventPath(eventId)}/gates`, {
        method: "POST",
        body: JSON.stringify(CreateGateSchema.parse(input)),
      }),
    );
  },
  async report(eventId: string, period: ReportPeriod, signal?: AbortSignal) {
    return ReportSchema.parse(
      await apiClient<unknown>(
        `${eventPath(eventId)}/reports?${periodQuery(period)}`,
        { signal },
      ),
    );
  },
  async ticketTypes(eventId: string, signal?: AbortSignal) {
    return z
      .object({
        ticketTypes: z.array(z.object({ id: z.uuid(), name: z.string() })),
      })
      .parse(await apiClient<unknown>(eventPath(eventId), { signal }))
      .ticketTypes;
  },
  async monitor(eventId: string, signal?: AbortSignal) {
    return CheckinSummarySchema.parse(
      await apiClient<unknown>(`${eventPath(eventId)}/checkins/summary`, {
        signal,
      }),
    );
  },
  async checkins(eventId: string, current = 1, signal?: AbortSignal) {
    return page(
      `${eventPath(eventId)}/checkins`,
      CheckinLogSchema,
      current,
      20,
      signal,
    );
  },
  async createExport(
    eventId: string,
    period: ReportPeriod,
    format: "csv" | "xlsx",
  ) {
    return ExportJobSchema.parse(
      await apiClient<unknown>(`${eventPath(eventId)}/reports/exports`, {
        method: "POST",
        body: JSON.stringify({ ...periodInput(period), format }),
      }),
    );
  },
  async exports(eventId: string, current = 1, signal?: AbortSignal) {
    return page(
      `${eventPath(eventId)}/reports/exports`,
      ExportJobSchema,
      current,
      20,
      signal,
    );
  },
  async exportJob(eventId: string, jobId: string, signal?: AbortSignal) {
    return ExportJobSchema.parse(
      await apiClient<unknown>(
        `${eventPath(eventId)}/reports/exports/${z.uuid().parse(jobId)}`,
        { signal },
      ),
    );
  },
  async downloadExport(eventId: string, jobId: string) {
    return apiBlob(
      `${eventPath(eventId)}/reports/exports/${z.uuid().parse(jobId)}/download`,
    );
  },
};
const messages: Record<string, string> = {
  EMAIL_ALREADY_EXISTS: "Email đã tồn tại. Hãy dùng tài khoản khác.",
  EXPORT_QUEUE_LIMIT: "Bạn đã có 3 báo cáo đang chờ. Vui lòng chờ xử lý xong.",
  EXPORT_EXPIRED: "Tệp báo cáo đã hết hạn. Vui lòng tạo báo cáo mới.",
  EXPORT_NOT_READY: "Báo cáo chưa hoàn tất. Vui lòng kiểm tra lại trạng thái.",
  EXPORT_FILE_NOT_FOUND: "Không tìm thấy tệp báo cáo. Vui lòng tạo lại.",
  REPORT_TOO_LARGE: "Báo cáo quá lớn. Hãy thu hẹp bộ lọc hoặc xuất tệp nền.",
  STAFF_NOT_FOUND:
    "Nhân viên không tồn tại, đã khóa hoặc không thuộc quyền quản lý.",
  GATE_NOT_FOUND: "Cổng không thuộc sự kiện này.",
  ASSIGNMENT_NOT_FOUND: "Phân công không còn tồn tại. Vui lòng tải lại.",
};
export function operationsError(error: unknown): string {
  if (error instanceof ApiError) {
    const message = messages[error.code] || messages[error.message];
    if (message) return message;
    if (error.status === 401)
      return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    if (error.status === 403)
      return "Chức năng này chỉ dành cho Ban tổ chức có quyền quản lý sự kiện.";
    if (error.status === 404 || error.status === 501)
      return "Chức năng hoặc dữ liệu chưa có trên máy chủ. Vui lòng kiểm tra phiên bản backend.";
    if (error.status === 422) return messages.REPORT_TOO_LARGE!;
    if (error.status === 410) return messages.EXPORT_EXPIRED!;
    return error.message;
  }
  if (error instanceof z.ZodError)
    return "Dữ liệu máy chủ không khớp hợp đồng API W05. Vui lòng kiểm tra phiên bản backend.";
  return error instanceof Error
    ? error.message
    : "Không thể xử lý yêu cầu. Vui lòng thử lại.";
}
