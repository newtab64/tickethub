"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/identity";
import { Button } from "@/shared/ui/button";
import { organizerOperationsApi as api } from "../api/organizer-operations-api";
import {
  Metric,
  panelClass,
  QueryMessage,
  time,
  number,
  Pagination,
} from "./operations-shared";
export function GateMonitoring({ eventId }: { eventId: string }) {
  const { user } = useSession();
  const [live, setLive] = useState(true);
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["organizer", user?.id, eventId, "gate-monitor"],
    queryFn: ({ signal }) => api.monitor(eventId, signal),
    retry: false,
    refetchInterval: (q) =>
      live && !q.state.error
        ? Math.max(5000, q.state.data?.suggestedPollIntervalMs || 5000)
        : false,
    refetchIntervalInBackground: false,
  });
  const history = useQuery({
    queryKey: ["organizer", user?.id, eventId, "checkins", page],
    queryFn: ({ signal }) => api.checkins(eventId, page, signal),
    retry: false,
    refetchInterval: (q) =>
      live && page === 1 && !q.state.error ? 5000 : false,
    refetchIntervalInBackground: false,
  });
  const data = query.data;
  const gateName = (id: string | null) =>
    data?.gates.find((g) => g.gateId === id)?.gateName ||
    (id ? `Cổng ${id.slice(0, 8)}` : "Chưa xác định cổng");
  return (
    <div className="space-y-5">
      <div
        className={`${panelClass} flex flex-wrap items-center justify-between gap-4`}
      >
        <div>
          <h2 className="font-semibold">Theo dõi vào cổng</h2>
          <p role="status" className="text-sm text-muted-foreground mt-1">
            {query.error || history.error
              ? "Mất kết nối cập nhật. Dữ liệu bên dưới có thể đã cũ."
              : live
                ? "Tự động cập nhật mỗi 5 giây khi đang mở trang"
                : "Đã tạm dừng cập nhật"}
          </p>
          {data && (
            <p className="text-xs text-muted-foreground mt-2">
              Lần cập nhật dữ liệu trực tiếp: {time(data.generatedAt)}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            aria-pressed={live}
            onClick={() => setLive(!live)}
          >
            {live ? "Tạm dừng" : "Tiếp tục"}
          </Button>
          <Button
            disabled={query.isFetching || history.isFetching}
            onClick={() => {
              void query.refetch();
              void history.refetch();
            }}
          >
            Làm mới
          </Button>
        </div>
      </div>
      <QueryMessage
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Vé đã vào cổng"
              value={number(data.summary.checkedInTickets)}
              note={`${data.summary.checkinPercentage.toFixed(2)}% / ${number(data.summary.validTickets)} vé còn hiệu lực`}
            />
            <Metric
              label="Vé chưa vào cổng"
              value={number(data.summary.remainingTickets)}
              note="Vé SOLD của toàn sự kiện"
            />
            <Metric
              label="Lượt quét thành công"
              value={number(data.summary.successfulAttempts)}
              note="Số lượt quét, tách riêng số vé đã check-in"
            />
            <Metric
              label="Lượt quét bị từ chối"
              value={number(data.summary.rejectedAttempts)}
              note="Bao gồm quét lặp, QR lỗi hoặc không có quyền"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.gates.map((gate, i) => (
              <div
                key={gate.gateId || `unknown-${i}`}
                className={`${panelClass} space-y-2`}
              >
                <h3 className="font-semibold">
                  {gate.gateName || "Chưa xác định cổng"}
                </h3>
                <p className="text-3xl font-semibold">
                  {number(gate.checkedInTickets)}{" "}
                  <span className="text-xs font-normal">vé đã vào</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {gate.activeAssignedStaff} nhân viên hoạt động được phân công
                </p>
                <p className="text-xs">
                  {gate.successfulAttempts} lượt thành công ·{" "}
                  {gate.rejectedAttempts} lượt bị từ chối
                </p>
                {gate.lastScanAt && (
                  <p className="text-xs text-muted-foreground">
                    Lượt gần nhất: {time(gate.lastScanAt)}
                  </p>
                )}
              </div>
            ))}
          </div>
          {!data.gates.length && (
            <p className={panelClass}>Chưa có cổng vào cho sự kiện này.</p>
          )}
          <div className={`${panelClass} overflow-x-auto`}>
            <h2 className="font-semibold text-lg mb-4">
              Lưu lượng 24 giờ gần nhất
            </h2>
            <table className="w-full text-sm text-left">
              <thead>
                <tr>
                  <th scope="col" className="pb-3">
                    Giờ Việt Nam
                  </th>
                  <th scope="col">Thành công</th>
                  <th scope="col">Bị từ chối</th>
                </tr>
              </thead>
              <tbody>
                {data.timelineLast24Hours.map((row) => (
                  <tr key={row.hour} className="border-t">
                    <td className="py-3">{time(row.hour)}</td>
                    <td>{row.successfulAttempts}</td>
                    <td>{row.rejectedAttempts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.timelineLast24Hours.length && (
              <p className="text-sm text-muted-foreground py-5">
                Chưa có lượt quét trong 24 giờ gần nhất.
              </p>
            )}
          </div>
        </>
      )}
      <QueryMessage
        loading={history.isPending}
        error={history.error}
        retry={() => void history.refetch()}
      />
      {history.data && (
        <div className={`${panelClass} overflow-x-auto`}>
          <table className="w-full text-left text-sm">
            <caption className="mb-4 text-left text-lg font-semibold">
              Lịch sử quét cổng
            </caption>
            <thead className="border-b text-muted-foreground">
              <tr>
                {[
                  "Thời gian",
                  "Cổng",
                  "Mã nhân viên",
                  "Phương thức",
                  "Kết quả",
                ].map((name) => (
                  <th key={name} scope="col" className="py-3 pr-4">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.data.data.map((scan) => (
                <tr key={scan.id} className="border-b last:border-0">
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {time(scan.checkedInAt)}
                  </td>
                  <td className="pr-4">{gateName(scan.gateId)}</td>
                  <td className="pr-4">
                    <span title={scan.staffId}>{scan.staffId.slice(0, 8)}</span>
                  </td>
                  <td className="pr-4">
                    {scan.method === "QR"
                      ? "QR"
                      : scan.method === "MANUAL"
                        ? "Thủ công"
                        : scan.method}
                  </td>
                  <td>
                    <span
                      className={
                        scan.outcome === "SUCCESS"
                          ? "text-emerald-700"
                          : "text-destructive"
                      }
                    >
                      {scan.outcome === "SUCCESS" ? "Thành công" : "Bị từ chối"}
                    </span>
                    {scan.errorCode && (
                      <p className="text-xs">{scan.errorCode}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!history.data.data.length && (
            <p className="py-6 text-sm text-muted-foreground">
              Chưa ghi nhận lượt quét.
            </p>
          )}
          <Pagination
            meta={history.data.meta}
            busy={history.isFetching}
            onPage={setPage}
          />
        </div>
      )}
    </div>
  );
}
