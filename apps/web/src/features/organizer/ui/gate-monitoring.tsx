"use client";

import { useSession } from "@/features/identity";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/shared/ui/button";
import { organizerOperationsApi } from "../api/organizer-operations-api";
import {
  Metric,
  panelClass,
  QueryMessage,
  time,
  number,
} from "./operations-shared";

export function GateMonitoring({ eventId }: { eventId: string }) {
  const { user } = useSession();
  const [live, setLive] = useState(true);
  const query = useQuery({
    queryKey: ["organizer", user?.id, eventId, "gate-monitor"],
    queryFn: ({ signal }) => organizerOperationsApi.monitor(eventId, signal),
    retry: false,
    refetchInterval: (query) => (live && !query.state.error ? 5000 : false),
    refetchIntervalInBackground: false,
  });
  const data = query.data;
  return (
    <div className="space-y-5">
      <div
        className={`${panelClass} flex flex-wrap items-center justify-between gap-4`}
      >
        <div>
          <h2 className="font-semibold">Theo dõi vào cổng</h2>
          <p role="status" className="text-sm text-muted-foreground mt-1">
            {query.error
              ? "Mất kết nối cập nhật. Dữ liệu bên dưới có thể đã cũ."
              : live
                ? "Tự động cập nhật mỗi 5 giây khi đang mở trang"
                : "Đã tạm dừng cập nhật"}
          </p>
          {data && (
            <p className="text-xs text-muted-foreground mt-2">
              Lần cập nhật dữ liệu: {time(data.updatedAt)}
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
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.gates.map((gate) => (
              <Metric
                key={gate.id}
                label={gate.name}
                value={number(gate.checkedIn)}
                note={`${gate.staffCount} nhân viên được phân công đang hoạt động`}
              />
            ))}
          </div>
          {!data.gates.length && (
            <p className={panelClass}>Chưa có cổng vào cho sự kiện này.</p>
          )}
          <div className={`${panelClass} overflow-x-auto`}>
            <table className="w-full text-left text-sm">
              <caption className="mb-4 text-left text-lg font-semibold">
                Lượt check-in gần nhất
              </caption>
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th scope="col" className="py-3 pr-4">
                    Thời gian
                  </th>
                  <th scope="col" className="py-3 pr-4">
                    Cổng
                  </th>
                  <th scope="col" className="py-3">
                    Nhân viên
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((scan) => (
                  <tr key={scan.id} className="border-b last:border-0">
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {time(scan.checkedInAt)}
                    </td>
                    <td className="pr-4">{scan.gateName}</td>
                    <td>{scan.staffName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.recent.length && (
              <p className="py-6 text-sm text-muted-foreground">
                Chưa ghi nhận lượt check-in.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
