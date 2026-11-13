import { z } from "zod";
import { apiClient, ApiError } from "@/shared/api/client";
import {
  OperationEventSchema,
  StaffListSchema,
  StaffSchema,
  ReportSchema,
  GateMonitorSchema,
  ExportJobSchema,
  CreateStaffSchema,
  periodQuery,
  type CreateStaff,
  type ReportPeriod,
} from "../domain/operations";

const eventPath = (id: string) => `/organizer/events/${z.uuid().parse(id)}`;

export const organizerOperationsApi = {
  async events(signal?: AbortSignal) {
    const data = await apiClient<unknown>("/organizer/events", { signal });
    return z.object({ items: z.array(OperationEventSchema) }).parse(data).items;
  },
  async staff(eventId: string, signal?: AbortSignal) {
    return StaffListSchema.parse(
      await apiClient<unknown>(`${eventPath(eventId)}/staff`, { signal }),
    );
  },
  async createStaff(eventId: string, input: CreateStaff) {
    return StaffSchema.parse(
      await apiClient<unknown>(`${eventPath(eventId)}/staff`, {
        method: "POST",
        body: JSON.stringify(CreateStaffSchema.parse(input)),
      }),
    );
  },
  async updateStaff(
    eventId: string,
    staffId: string,
    patch: { gateId?: string; status?: "ACTIVE" | "LOCKED" },
  ) {
    return StaffSchema.parse(
      await apiClient<unknown>(
        `${eventPath(eventId)}/staff/${z.uuid().parse(staffId)}`,
        { method: "PATCH", body: JSON.stringify(patch) },
      ),
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
  async monitor(eventId: string, signal?: AbortSignal) {
    return GateMonitorSchema.parse(
      await apiClient<unknown>(`${eventPath(eventId)}/gate-monitor`, {
        signal,
      }),
    );
  },
  async createExport(
    eventId: string,
    period: ReportPeriod,
    format: "csv" | "xlsx",
    idempotencyKey: string,
  ) {
    periodQuery(period);
    return ExportJobSchema.parse(
      await apiClient<unknown>(`${eventPath(eventId)}/report-exports`, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          ...period,
          timezone: "Asia/Ho_Chi_Minh",
          format,
        }),
      }),
    );
  },
  async exportJob(eventId: string, jobId: string, signal?: AbortSignal) {
    return ExportJobSchema.parse(
      await apiClient<unknown>(
        `${eventPath(eventId)}/report-exports/${z.uuid().parse(jobId)}`,
        { signal },
      ),
    );
  },
};

export function operationsError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404 || error.status === 501)
      return "Chức năng chưa được máy chủ hỗ trợ. Vui lòng thử lại sau.";
    if (error.status === 401)
      return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    if (error.status === 403) return "Bạn không có quyền quản lý sự kiện này.";
    return error.message;
  }
  if (error instanceof z.ZodError)
    return "Dữ liệu máy chủ chưa hợp lệ. Vui lòng thử lại sau.";
  return error instanceof Error
    ? error.message
    : "Không thể xử lý yêu cầu. Vui lòng thử lại.";
}
