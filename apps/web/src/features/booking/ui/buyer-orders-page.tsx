"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BuyerOrderPageSchema, OrderStatus } from "@tickethub/shared";
import { apiEnvelope } from "@/shared/api/client";
import { money, dateTime, orderStatusLabel } from "@/features/payment";
import { FlowShell, FlowError } from "@/shared/ui/flow-shell";
import { Button } from "@/shared/ui/button";

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const query = useQuery({
    queryKey: ["buyer-orders", page, status],
    queryFn: async () =>
      BuyerOrderPageSchema.parse(
        await apiEnvelope<unknown>(
          `/buyer/orders?page=${page}&limit=10${status ? `&status=${status}` : ""}`,
        ),
      ),
    retry: false,
  });
  const orders = query.data?.data;
  return (
    <FlowShell title="Đơn hàng của tôi">
      <label className="mb-5 flex flex-wrap items-center gap-3 text-sm font-semibold">
        Trạng thái
        <select
          className="min-h-10 max-w-full rounded-lg border border-input bg-background px-3 text-sm font-medium"
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
      {orders?.length === 0 && (
        <p>
          Chưa có đơn hàng phù hợp.{" "}
          <Link className="underline text-primary" href="/">
            Khám phá sự kiện
          </Link>
        </p>
      )}
      <ul className="grid gap-4 lg:grid-cols-2">
        {orders?.map((order) => (
          <li
            key={order.id}
            className="min-w-0 rounded-xl border border-border bg-background p-4 sm:p-5"
          >
            <div className="flex flex-wrap justify-between gap-3">
              <h2 className="text-lg font-bold">{order.eventTitle}</h2>
              <span className="rounded-full bg-accent px-3 py-1 text-sm text-accent-foreground">
                {orderStatusLabel[order.status]}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {order.orderCode}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {dateTime(order.eventStartTime)} · {order.eventVenueName}
            </p>
            <p className="my-3 text-sm font-semibold tabular-nums">
              {order.ticketCount} vé · {money(order.finalAmount)}
            </p>
            <Link
              className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
              href={`/buyer/orders/${order.id}`}
            >
              Xem chi tiết
            </Link>
            {order.status === "PENDING" && (
              <Link
                className="ml-4 inline-block text-sm font-medium underline-offset-4 hover:underline"
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
          disabled={
            !query.data ||
            page >= query.data.meta.totalPages ||
            query.isFetching
          }
          onClick={() => setPage((p) => p + 1)}
        >
          Trang sau
        </Button>
      </nav>
    </FlowShell>
  );
}
