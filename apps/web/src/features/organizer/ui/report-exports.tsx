"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/identity";
import { Button } from "@/shared/ui/button";
import {
  organizerOperationsApi as api,
  operationsError,
} from "../api/organizer-operations-api";
import {
  isExportPending,
  type ExportJob,
  type ReportPeriod,
} from "../domain/operations";
import {
  Field,
  panelClass,
  QueryMessage,
  Pagination,
  selectClass,
  time,
} from "./operations-shared";
const labels: Record<ExportJob["status"], string> = {
  PENDING: "Đang chờ xử lý",
  PROCESSING: "Đang tạo tệp",
  COMPLETED: "Đã hoàn tất",
  FAILED: "Xuất thất bại",
  EXPIRED: "Đã hết hạn",
};
export function ReportExports({
  eventId,
  period,
  ticketTypes,
}: {
  eventId: string;
  period: ReportPeriod;
  ticketTypes: { id: string; name: string }[];
}) {
  const { user } = useSession();
  const cache = useQueryClient();
  const [page, setPage] = useState(1);
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");
  const prefix = ["organizer", user?.id, eventId, "exports"];
  const jobs = useQuery({
    queryKey: [...prefix, page],
    queryFn: ({ signal }) => api.exports(eventId, page, signal),
    staleTime: 0,
    retry: false,
    refetchInterval: (q) =>
      !q.state.error &&
      q.state.data?.data.some((job) => isExportPending(job.status))
        ? 3000
        : false,
  });
  const create = useMutation({
    mutationFn: (input: { period: ReportPeriod; format: "csv" | "xlsx" }) =>
      api.createExport(eventId, input.period, input.format),
    onSuccess: async () => {
      setPage(1);
      await cache.invalidateQueries({ queryKey: prefix });
    },
  });
  const download = useMutation({
    mutationFn: async (job: ExportJob) => {
      const latest = await api.exportJob(eventId, job.id);
      if (latest.status === "EXPIRED")
        throw new Error("Tệp báo cáo đã hết hạn. Vui lòng tạo báo cáo mới.");
      if (latest.status !== "COMPLETED")
        throw new Error("Báo cáo chưa hoàn tất. Vui lòng thử lại.");
      const blob = await api.downloadExport(eventId, job.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `event-report-${job.id}.${job.format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    onError: () => {
      void cache.invalidateQueries({ queryKey: prefix });
    },
  });
  return (
    <div className={`${panelClass} space-y-5`}>
      <h2 className="text-lg font-semibold">Xuất báo cáo và lịch sử tệp</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <Field label="Định dạng báo cáo">
            <select
              aria-label="Định dạng báo cáo"
              className={selectClass}
              value={format}
              disabled={create.isPending}
              onChange={(e) => setFormat(e.target.value as "csv" | "xlsx")}
            >
              <option value="csv">CSV</option>
              <option value="xlsx">Excel (.xlsx)</option>
            </select>
          </Field>
        </div>
        <Button
          disabled={create.isPending}
          onClick={() => create.mutate({ period: { ...period }, format })}
        >
          {create.isPending ? "Đang gửi yêu cầu..." : "Xuất báo cáo"}
        </Button>
        <Button
          variant="outline"
          disabled={jobs.isFetching}
          onClick={() => void jobs.refetch()}
        >
          Cập nhật danh sách tệp
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Xuất theo bộ lọc đã áp dụng. Tối đa 3 tác vụ chờ/xử lý cho mỗi tài
        khoản. Dữ liệu lấy tại lúc worker xử lý và có thể khác lần xem
        dashboard.
      </p>
      {create.isSuccess && (
        <p role="status" className="text-sm text-primary">
          Đã gửi yêu cầu xuất báo cáo. Trạng thái sẽ tự cập nhật.
        </p>
      )}
      {(create.error || download.error) && (
        <p role="alert" className="text-sm text-destructive">
          {operationsError(create.error || download.error)}
        </p>
      )}
      <QueryMessage
        loading={jobs.isPending}
        error={jobs.error}
        retry={() => void jobs.refetch()}
      />
      {jobs.data && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Lịch sử xuất báo cáo</caption>
              <thead className="border-b text-muted-foreground">
                <tr>
                  {["Yêu cầu", "Bộ lọc", "Trạng thái", "Tải tệp"].map((v) => (
                    <th key={v} scope="col" className="pb-3 pr-4">
                      {v}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.data.data.map((job) => (
                  <tr key={job.id} className="border-b last:border-0">
                    <td className="py-4 pr-4 whitespace-nowrap">
                      {job.format.toUpperCase()}
                      <p className="text-xs text-muted-foreground">
                        {time(job.createdAt)}
                      </p>
                    </td>
                    <td className="py-4 pr-4 min-w-44">
                      <p>
                        {job.fromDate || "Tất cả ngày"}
                        {job.toDate ? ` đến ${job.toDate}` : ""}
                      </p>
                      {job.ticketTypeId && (
                        <p className="text-xs">
                          Hạng vé:{" "}
                          {ticketTypes.find(
                            (type) => type.id === job.ticketTypeId,
                          )?.name || "Không còn trong danh sách"}
                        </p>
                      )}
                      {job.voucherCode && (
                        <p className="text-xs">Voucher: {job.voucherCode}</p>
                      )}
                    </td>
                    <td className="py-4 pr-4">
                      <span role="status">{labels[job.status]}</span>
                      {job.expiresAt && (
                        <p className="text-xs text-muted-foreground">
                          Hạn tải: {time(job.expiresAt)}
                        </p>
                      )}
                      {job.status === "FAILED" && (
                        <p className="text-xs text-destructive">
                          Vui lòng tạo yêu cầu mới.
                        </p>
                      )}
                    </td>
                    <td>
                      <Button
                        variant="outline"
                        disabled={
                          job.status !== "COMPLETED" || download.isPending
                        }
                        onClick={() => download.mutate(job)}
                      >
                        {download.isPending && download.variables?.id === job.id
                          ? "Đang tải..."
                          : "Tải báo cáo"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!jobs.data.data.length && (
              <p className="py-6 text-sm text-muted-foreground">
                Chưa có yêu cầu xuất báo cáo.
              </p>
            )}
          </div>
          <Pagination
            meta={jobs.data.meta}
            busy={jobs.isFetching}
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}
