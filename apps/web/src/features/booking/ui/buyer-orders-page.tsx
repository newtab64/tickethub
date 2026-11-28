"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import {
  BuyerOrderPageSchema,
  OrderStatus,
  type BuyerOrderSummaryItem,
} from "@tickethub/shared";
import { apiEnvelope } from "@/shared/api/client";
import { dateTime, orderStatusLabel } from "@/features/payment";
import { EventPoster } from "@/features/event";
import { HeaderActions } from "@/features/identity";
import { SiteHeader } from "@/shared/ui/site-header";
import { FlowShell, FlowError } from "@/shared/ui/flow-shell";
import { CustomSelect } from "@/shared/ui/custom-select";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { orderTone } from "../domain/order-list";

const FILTERS = [
  { value: "", label: "Tất cả" },
  ...Object.values(OrderStatus).map((value) => ({
    value,
    label: orderStatusLabel[value],
  })),
];
const FILTER_ID = "order-filter";
const CARD = "rounded-3xl bg-background shadow-sheet";

/** Cả dòng là một liên kết tới chi tiết đơn. */
function OrderRow({ order }: { order: BuyerOrderSummaryItem }) {
  return (
    <li className="border-t border-border first:border-t-0">
      <Link
        href={`/buyer/orders/${order.id}`}
        className="flex items-center gap-4 rounded-2xl py-4 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-solid"
      >
        <span className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-muted">
          <EventPoster
            event={{
              id: order.eventId,
              title: order.eventTitle,
              bannerUrl: order.eventBannerUrl,
            }}
            sizes="64px"
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold break-words">
            {order.eventTitle}
          </span>
          <span className="block text-[13px] text-muted-foreground tabular-nums">
            {dateTime(order.eventStartTime)} · {order.ticketCount} vé
          </span>
          <Badge
            variant={orderTone(order.status)}
            className="mt-1 h-auto min-h-7 py-1 whitespace-normal"
          >
            {orderStatusLabel[order.status]}
          </Badge>
        </span>
        <ChevronRight
          aria-hidden="true"
          className="size-5 shrink-0 text-muted-foreground"
        />
      </Link>
    </li>
  );
}

function Message({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      className={`${CARD} grid justify-items-center gap-2 px-6 py-12 text-center`}
    >
      <p className="text-[17px] font-semibold">{title}</p>
      {children}
    </div>
  );
}

function Loading() {
  return (
    <div className={`${CARD} px-6 py-2`}>
      <p role="status" className="sr-only">
        Đang tải vé của bạn
      </p>
      {[0, 1, 2, 3].map((row) => (
        <div
          key={row}
          aria-hidden="true"
          className="flex animate-pulse items-center gap-4 border-t border-border py-4 first-of-type:border-t-0 motion-reduce:animate-none"
        >
          <span className="size-16 rounded-2xl bg-fill" />
          <span className="grid flex-1 gap-3">
            <span className="h-4 w-3/4 rounded-full bg-fill" />
            <span className="h-4 w-2/5 rounded-full bg-fill" />
          </span>
        </div>
      ))}
    </div>
  );
}

export default function OrdersPage() {
  const [status, setStatus] = useState("");
  const list = useRef<HTMLUListElement>(null);
  const query = useInfiniteQuery({
    // Mỗi bộ lọc một khóa riêng nên trang đang tải không lẫn sang bộ lọc khác.
    queryKey: ["buyer-orders", status],
    queryFn: async ({ pageParam }) =>
      BuyerOrderPageSchema.parse(
        await apiEnvelope<unknown>(
          `/buyer/orders?page=${pageParam}&limit=10${status ? `&status=${status}` : ""}`,
        ),
      ),
    initialPageParam: 1,
    getNextPageParam: (last, pages) =>
      pages.length < last.meta.totalPages ? pages.length + 1 : undefined,
    retry: false,
  });
  // Đơn mới tạo đẩy đơn cũ sang trang sau, nên lọc trùng theo id.
  const orders = query.data && [
    ...new Map(
      query.data.pages
        .flatMap((page) => page.data)
        .map((order) => [order.id, order]),
    ).values(),
  ];

  const loadMore = async () => {
    if (query.isFetchingNextPage) return;
    const before = orders?.length ?? 0;
    const result = await query.fetchNextPage();
    // Hết trang thì nút biến mất: đưa tiêu điểm sang đơn mới đầu tiên.
    if (!result.hasNextPage && !result.isError) {
      requestAnimationFrame(() => {
        // Người dùng đã chuyển đi nơi khác thì không kéo họ về.
        if (document.activeElement !== document.body) return;
        list.current?.querySelectorAll("a")[before]?.focus();
      });
    }
  };

  return (
    <FlowShell
      header={<SiteHeader actions={<HeaderActions ticketsCurrent />} />}
      className="bg-checkout-page"
      mainClassName="flex max-w-152 flex-col gap-4 pt-8 sm:pt-8"
    >
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[28px] font-semibold tracking-tight whitespace-nowrap">
          Vé của tôi
        </h1>
        <div className="min-w-0">
          <CustomSelect
            id={FILTER_ID}
            surface
            align="end"
            ariaLabel="Lọc theo trạng thái"
            options={FILTERS}
            value={status}
            onChange={setStatus}
          />
        </div>
      </div>
      {query.isPending ? (
        <Loading />
      ) : !orders ? (
        <Message title="Chưa tải được vé của bạn">
          <FlowError error={query.error} />
          <Button size="lg" className="mt-4" onClick={() => query.refetch()}>
            Thử lại
          </Button>
        </Message>
      ) : orders.length === 0 ? (
        status ? (
          <Message title="Không có đơn nào ở trạng thái này">
            <p className="text-[13px] text-muted-foreground">
              Chọn trạng thái khác để xem.
            </p>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => {
                setStatus("");
                // Nút này sắp biến mất, đưa tiêu điểm về ô lọc.
                document.getElementById(FILTER_ID)?.focus();
              }}
            >
              Xem tất cả
            </Button>
          </Message>
        ) : (
          <Message title="Bạn chưa có vé nào">
            <p className="text-[13px] text-muted-foreground">
              Vé đã mua sẽ nằm ở đây.
            </p>
            <Button asChild size="lg" className="mt-4">
              <Link href="/">Khám phá sự kiện</Link>
            </Button>
          </Message>
        )
      ) : (
        <>
          <ul ref={list} className={`${CARD} px-6 py-2`}>
            {orders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </ul>
          {query.error && <FlowError error={query.error} />}
          {query.hasNextPage && (
            <Button
              variant="surface"
              size="lg"
              className="self-center"
              // Không khóa nút để người dùng bàn phím giữ được tiêu điểm.
              aria-disabled={query.isFetchingNextPage}
              onClick={loadMore}
            >
              Xem thêm
            </Button>
          )}
        </>
      )}
    </FlowShell>
  );
}
