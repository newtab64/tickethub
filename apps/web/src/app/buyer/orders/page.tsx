"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BuyerOrderSummarySchema, OrderStatus } from "@tickethub/shared";
import { apiClient } from "@/lib/api/client";
import { money, dateTime, orderStatusLabel } from "@/lib/checkout";
import { FlowShell, FlowError } from "@/components/checkout/flow-shell";
import { Button } from "@/components/ui/button";

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const query = useQuery({
    queryKey: ["buyer-orders", page, status],
    queryFn: async () =>
      BuyerOrderSummarySchema.array().parse(
        await apiClient<unknown>(
          `/buyer/orders?page=${page}&limit=10${status ? `&status=${status}` : ""}`,
        ),
      ),
    retry: false,
  });
  return (
    <FlowShell title="Đơn hàng của tôi">
      <label className="mb-6 block">
        Trạng thái{" "}
        <select
          className="ml-2 rounded-lg border border-input bg-background p-2"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả</option>
          {Object.values(OrderStatus).map((value) => (
            <option key={value} value={value}>
              {orderStatusLabel[value]}
            </option>
          ))}
        </select>
      </label>
      {query.isPending && <p role="status">Đang tải đơn hàng...</p>}
      {query.error && (
        <>
          <FlowError error={query.error} />
          <Button className="mt-4" onClick={() => query.refetch()}>
            Thử lại
          </Button>
        </>
      )}
      {query.data?.length === 0 && (
        <p>
          Chưa có đơn hàng phù hợp.{" "}
          <Link className="underline text-primary" href="/">
            Khám phá sự kiện
          </Link>
        </p>
      )}
      <ul className="space-y-4">
        {query.data?.map((order) => (
          <li
            key={order.id}
            className="rounded-xl border border-border bg-background p-5"
          >
            <div className="flex flex-wrap justify-between gap-3">
              <h2 className="text-lg font-bold">{order.eventTitle}</h2>
              <span className="rounded-full bg-accent px-3 py-1 text-sm text-accent-foreground">
                {orderStatusLabel[order.status]}
              </span>
            </div>
            <p className="mt-2 font-mono text-sm">{order.orderCode}</p>
            <p className="mt-2 text-muted-foreground">
              {dateTime(order.eventStartTime)} · {order.eventVenueName}
            </p>
            <p className="my-3">
              {order.ticketCount} vé · {money(order.finalAmount)}
            </p>
            <Link
              className="font-semibold text-primary underline"
              href={`/buyer/orders/${order.id}`}
            >
              Xem chi tiết
            </Link>
            {order.status === "PENDING" && (
              <Link
                className="ml-5 underline"
                href={`/checkout?orderId=${order.id}`}
              >
                Tiếp tục thanh toán
              </Link>
            )}
          </li>
        ))}
      </ul>
      <nav
        aria-label="Phân trang đơn hàng"
        className="mt-6 flex items-center gap-4"
      >
        <Button
          variant="outline"
          disabled={page === 1 || query.isFetching}
          onClick={() => setPage((p) => p - 1)}
        >
          Trang trước
        </Button>
        <span>Trang {page}</span>
        <Button
          variant="outline"
          disabled={!query.data || query.data.length < 10 || query.isFetching}
          onClick={() => setPage((p) => p + 1)}
        >
          Trang sau
        </Button>
      </nav>
    </FlowShell>
  );
}
