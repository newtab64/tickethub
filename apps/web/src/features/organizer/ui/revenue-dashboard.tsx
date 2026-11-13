"use client";

import { useSession } from "@/features/identity";
import { useState, type FormEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  organizerOperationsApi,
  operationsError,
} from "../api/organizer-operations-api";
import {
  initialPeriod,
  validatePeriod,
  checkInPercent,
  safeDownloadUrl,
  type ReportPeriod,
  type ExportJob,
} from "../domain/operations";
import {
  Field,
  Metric,
  panelClass,
  QueryMessage,
  selectClass,
  time,
  vnd,
  number,
} from "./operations-shared";

function ReportExport({
  eventId,
  period,
  available,
}: {
  eventId: string;
  period: ReportPeriod;
  available: boolean;
}) {
  const { user } = useSession();
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");
  const [createdJob, setCreatedJob] = useState<{
    job: ExportJob;
    period: ReportPeriod;
    format: string;
  } | null>(null);
  const create = useMutation({
    mutationFn: (input: { period: ReportPeriod; format: "csv" | "xlsx" }) =>
      organizerOperationsApi.createExport(
        eventId,
        input.period,
        input.format,
        crypto.randomUUID(),
      ),
    onSuccess: (job, input) => setCreatedJob({ job, ...input }),
  });
  const status = useQuery({
    queryKey: ["organizer", user?.id, eventId, "export", createdJob?.job.id],
    queryFn: ({ signal }) =>
      organizerOperationsApi.exportJob(eventId, createdJob!.job.id, signal),
    enabled: Boolean(createdJob),
    initialData: createdJob?.job,
    staleTime: 0,
    retry: false,
    refetchInterval: (query) =>
      query.state.error ||
      ["COMPLETED", "FAILED"].includes(query.state.data?.status || "")
        ? false
        : 3000,
  });
  const job = status.data;
  const busy =
    create.isPending ||
    Boolean(job && ["QUEUED", "PROCESSING"].includes(job.status));
  const download = safeDownloadUrl(job?.downloadUrl || null);
  if (!available && !createdJob && !create.isPending && !create.error)
    return null;
  return (
    <div className={`${panelClass} space-y-4`}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <Field label="Định dạng báo cáo">
            <select
              className={selectClass}
              value={format}
              disabled={busy || !available}
              onChange={(e) => setFormat(e.target.value as "csv" | "xlsx")}
            >
              <option value="csv">CSV</option>
              <option value="xlsx">Excel (.xlsx)</option>
            </select>
          </Field>
        </div>
        <Button
          disabled={busy || !available}
          onClick={() => create.mutate({ period: { ...period }, format })}
        >
          {busy ? "Đang xuất báo cáo..." : "Xuất báo cáo"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Tệp được tạo ở máy chủ. Bạn có thể tiếp tục xem báo cáo trong khi chờ.
      </p>
      {create.error && (
        <p role="alert" className="text-sm text-destructive">
          {operationsError(create.error)}
        </p>
      )}
      {createdJob && (
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Yêu cầu {createdJob.format.toUpperCase()}: {createdJob.period.from}{" "}
            đến {createdJob.period.to}
          </p>
          <p role="status">
            {job?.status === "QUEUED"
              ? "Đang chờ xử lý"
              : job?.status === "PROCESSING"
                ? "Đang tạo tệp"
                : job?.status === "COMPLETED"
                  ? "Báo cáo đã sẵn sàng"
                  : job?.status === "FAILED"
                    ? "Xuất báo cáo thất bại. Bạn có thể tạo yêu cầu mới."
                    : "Đang kiểm tra yêu cầu"}
          </p>
          {status.error && (
            <div role="alert">
              <p>{operationsError(status.error)}</p>
              <Button variant="outline" onClick={() => void status.refetch()}>
                Kiểm tra lại trạng thái
              </Button>
            </div>
          )}
          {job?.status === "COMPLETED" &&
            (download ? (
              <a
                className="inline-flex rounded-lg bg-emerald-700 px-4 py-2 text-white font-medium"
                href={download}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
              >
                Tải báo cáo
              </a>
            ) : (
              <p role="alert" className="text-destructive">
                Liên kết tải không an toàn. Vui lòng tạo lại báo cáo.
              </p>
            ))}
        </div>
      )}
    </div>
  );
}

export function RevenueDashboard({ eventId }: { eventId: string }) {
  const { user } = useSession();
  const [period, setPeriod] = useState(initialPeriod);
  const [draft, setDraft] = useState(period);
  const [error, setError] = useState("");
  const report = useQuery({
    queryKey: ["organizer", user?.id, eventId, "report", period],
    queryFn: ({ signal }) =>
      organizerOperationsApi.report(eventId, period, signal),
    retry: false,
  });
  function apply(e: FormEvent) {
    e.preventDefault();
    const issue = validatePeriod(draft);
    setError(issue || "");
    if (!issue) setPeriod({ ...draft });
  }
  const data = report.data;
  const percent = data ? checkInPercent(data.checkedIn, data.ticketsSold) : 0;
  const maxRevenue = Math.max(
    1,
    ...(data?.daily.map((day) => day.revenue) || []),
  );
  return (
    <div className="space-y-5">
      <form onSubmit={apply} className={`${panelClass} space-y-3`}>
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Từ ngày">
            <Input
              type="date"
              required
              className="h-10"
              value={draft.from}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            />
          </Field>
          <Field label="Đến ngày">
            <Input
              type="date"
              required
              className="h-10"
              value={draft.to}
              min={draft.from}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            />
          </Field>
          <Button type="submit">Áp dụng</Button>
          <Button
            type="button"
            variant="outline"
            disabled={report.isFetching}
            onClick={() => void report.refetch()}
          >
            Làm mới
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Theo ngày Việt Nam (UTC+7), bao gồm cả ngày bắt đầu và kết thúc. Doanh
          thu theo thời điểm thanh toán; check-in của các vé bán trong kỳ.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
      <QueryMessage
        loading={report.isPending}
        error={report.error}
        retry={() => void report.refetch()}
      />
      {data && (
        <>
          <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Kỳ báo cáo: {period.from} đến {period.to}
            </span>
            <span>
              {report.isFetching
                ? "Đang cập nhật..."
                : `Dữ liệu cập nhật: ${time(data.updatedAt)}`}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Metric
              label="Doanh thu thuần"
              value={vnd(data.revenue)}
              note="Đã trừ các khoản hoàn tiền hoàn tất"
            />
            <Metric
              label="Vé đã bán"
              value={number(data.ticketsSold)}
              note="Vé còn hiệu lực trong kỳ báo cáo"
            />
            <Metric
              label="Tỷ lệ check-in"
              value={`${percent.toFixed(1)}%`}
              note={`${number(data.checkedIn)} / ${number(data.ticketsSold)} vé đã bán trong kỳ`}
            />
          </div>
          <div className={`${panelClass} space-y-5`}>
            <h2 className="font-semibold text-lg">Doanh thu theo ngày</h2>
            {!data.daily.length ? (
              <p className="text-sm text-muted-foreground">
                Chưa có doanh thu trong khoảng thời gian này.
              </p>
            ) : (
              <div className="space-y-3">
                {data.daily.map((day) => (
                  <div
                    key={day.date}
                    className="grid grid-cols-[6rem_1fr] sm:grid-cols-[6rem_1fr_9rem] items-center gap-3 text-xs"
                  >
                    <span>{day.date}</span>
                    <div
                      className="h-6 rounded bg-emerald-50 overflow-hidden"
                      aria-hidden="true"
                    >
                      <div
                        className="h-full bg-emerald-600 rounded"
                        style={{
                          width: `${(day.revenue / maxRevenue) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="col-start-2 sm:col-start-auto tabular-nums sm:text-right">
                      {vnd(day.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className={`${panelClass} overflow-x-auto`}>
            <table className="w-full text-sm text-left">
              <caption className="text-left text-lg font-semibold mb-4">
                Vé bán theo hạng
              </caption>
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th scope="col" className="py-3">
                    Hạng vé
                  </th>
                  <th scope="col" className="text-right py-3">
                    Đã bán
                  </th>
                  <th scope="col" className="text-right py-3">
                    Doanh thu thuần
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.ticketTypes.map((item, i) => (
                  <tr
                    key={`${item.name}-${i}`}
                    className="border-b last:border-0"
                  >
                    <td className="py-4 pr-3">{item.name}</td>
                    <td className="py-4 text-right tabular-nums">
                      {number(item.sold)}
                    </td>
                    <td className="py-4 text-right tabular-nums">
                      {vnd(item.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.ticketTypes.length && (
              <p className="text-sm text-muted-foreground py-6">
                Chưa có vé bán trong kỳ.
              </p>
            )}
          </div>
        </>
      )}
      <ReportExport
        eventId={eventId}
        period={period}
        available={Boolean(data) && !report.error && !report.isPending}
      />
    </div>
  );
}
