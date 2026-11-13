"use client";
import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/identity";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { organizerOperationsApi as api } from "../api/organizer-operations-api";
import {
  initialPeriod,
  validatePeriod,
  salesGroups,
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
import { ReportExports } from "./report-exports";
export function RevenueDashboard({ eventId }: { eventId: string }) {
  const { user } = useSession();
  const [period, setPeriod] = useState(initialPeriod);
  const [draft, setDraft] = useState(period);
  const [error, setError] = useState("");
  const report = useQuery({
    queryKey: ["organizer", user?.id, eventId, "report", period],
    queryFn: ({ signal }) => api.report(eventId, period, signal),
    retry: false,
  });
  const types = useQuery({
    queryKey: ["organizer", user?.id, eventId, "ticket-types"],
    queryFn: ({ signal }) => api.ticketTypes(eventId, signal),
    retry: false,
  });
  function apply(e: FormEvent) {
    e.preventDefault();
    const issue = validatePeriod(draft);
    setError(issue || "");
    if (!issue)
      setPeriod({
        ...draft,
        voucherCode: draft.voucherCode?.trim().toUpperCase(),
      });
  }
  const data = report.data;
  const summary = data?.summary;
  const groups = salesGroups(data?.sales || []);
  const maxRevenue = Math.max(1, ...groups.daily.map((day) => day.revenue));
  return (
    <div className="space-y-5">
      <form onSubmit={apply} className={`${panelClass} space-y-4`}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <Field label="Hạng vé">
            <select
              aria-label="Hạng vé"
              className={selectClass}
              disabled={!types.data}
              value={draft.ticketTypeId || ""}
              onChange={(e) =>
                setDraft({ ...draft, ticketTypeId: e.target.value })
              }
            >
              <option value="">Tất cả hạng vé</option>
              {types.data?.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Mã voucher">
            <Input
              className="h-10"
              maxLength={50}
              value={draft.voucherCode || ""}
              onChange={(e) =>
                setDraft({ ...draft, voucherCode: e.target.value })
              }
              placeholder="Tất cả voucher"
            />
          </Field>
        </div>
        <div className="flex gap-3">
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
          Ngày Việt Nam (UTC+7), bao gồm hai đầu. Tiền thu theo ngày thanh toán;
          tiền hoàn theo ngày hoàn tất, vì vậy kỳ chỉ có hoàn tiền có thể âm. Số
          vé theo ngày thanh toán và trạng thái hiện tại.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {types.error && (
          <p className="text-xs text-destructive">
            Chưa tải được danh sách hạng vé.{" "}
            <button
              type="button"
              className="underline"
              onClick={() => void types.refetch()}
            >
              Thử lại
            </button>
          </p>
        )}
      </form>
      <p className="text-xs text-muted-foreground">
        Kỳ báo cáo: {period.from} đến {period.to}
        {period.ticketTypeId
          ? ` · Hạng vé: ${types.data?.find((type) => type.id === period.ticketTypeId)?.name || "Đã chọn"}`
          : ""}
        {period.voucherCode ? ` · Voucher: ${period.voucherCode}` : ""}
      </p>
      <QueryMessage
        loading={report.isPending}
        error={report.error}
        retry={() => void report.refetch()}
      />
      {data && !summary && (
        <p className={panelClass}>
          Chưa có dữ liệu tổng hợp cho sự kiện. Vui lòng chờ tiến trình báo cáo
          cập nhật.
        </p>
      )}
      {summary && (
        <>
          <p className="text-xs text-muted-foreground">
            Dữ liệu cập nhật: {time(summary.refreshed_at)}. Báo cáo có thể trễ
            khoảng 6 phút; nút làm mới không ép tính lại dữ liệu tổng hợp.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Metric
              label="Tiền thu sau hoàn"
              value={vnd(summary.net_revenue)}
              note="Tiền thực thu trừ hoàn tiền hoàn tất, chưa trừ phí"
            />
            <Metric
              label="Tiền thực thu"
              value={vnd(summary.paid_revenue)}
              note="Đã phân bổ giảm giá voucher"
            />
            <Metric
              label="Tiền đã hoàn"
              value={vnd(summary.total_refunded_amount)}
              note="Chỉ các khoản hoàn đã hoàn tất trong kỳ"
            />
            <Metric
              label="Vé còn hiệu lực"
              value={number(summary.total_sold_tickets)}
              note="SOLD và CHECKED_IN, theo ngày thanh toán"
            />
            <Metric
              label="Tỷ lệ check-in"
              value={`${summary.checkin_percentage.toFixed(2)}%`}
              note={`${number(summary.total_checked_in_tickets)} vé đã vào cổng trong nhóm vé bán của kỳ`}
            />
            <Metric
              label="Tỷ lệ hủy vé"
              value={
                data?.analytics
                  ? `${data.analytics.cancellationPercentage.toFixed(2)}%`
                  : "Chưa có dữ liệu"
              }
              note={`${number(summary.total_cancelled_tickets)} vé đã hủy trong nhóm vé của kỳ`}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Phí nền tảng, phí cổng thanh toán và số tiền chi trả chưa được cấu
            hình. Không dùng số liệu này làm số tiền chi trả cuối cùng.
          </p>
          <div className={`${panelClass} space-y-5`}>
            <h2 className="font-semibold text-lg">Tiền thực thu theo ngày</h2>
            {!groups.daily.length ? (
              <p className="text-sm text-muted-foreground">
                Chưa có khoản thu trong khoảng thời gian này.
              </p>
            ) : (
              <div className="space-y-3">
                {groups.daily.map((day) => (
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
                          width: `${(Math.max(0, day.revenue) / maxRevenue) * 100}%`,
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
                    Vé còn hiệu lực
                  </th>
                  <th scope="col" className="text-right py-3">
                    Tiền thực thu
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.ticketTypes.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
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
            {!groups.ticketTypes.length && (
              <p className="text-sm text-muted-foreground py-6">
                Chưa có doanh số theo hạng vé trong kỳ.
              </p>
            )}
          </div>
        </>
      )}
      <ReportExports
        eventId={eventId}
        period={period}
        ticketTypes={types.data || []}
      />
    </div>
  );
}
