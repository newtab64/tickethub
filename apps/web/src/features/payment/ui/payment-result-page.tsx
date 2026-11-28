"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, CircleHelp, Clock3, RotateCcw, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  BuyerOrderDetailSchema,
  type BuyerOrderDetail,
} from "@tickethub/shared";
import { apiClient } from "@/shared/api/client";
import { money, paymentState } from "../domain/order-checkout";
import {
  detailedState,
  resultView,
  type ResultState,
  type ResultView,
} from "../domain/payment-result";
import { EventPoster } from "@/features/event";
import { HeaderActions } from "@/features/identity";
import { SiteHeader } from "@/shared/ui/site-header";
import { FlowShell, FlowError } from "@/shared/ui/flow-shell";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

const TONE: Record<ResultView["tone"], string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  destructive: "bg-destructive/10 text-destructive",
  neutral: "bg-fill text-foreground",
};
const ICON: Record<ResultState, typeof Check> = {
  success: Check,
  processing: Clock3,
  refund_pending: RotateCcw,
  refunded: RotateCcw,
  failed: X,
  expired: X,
  refund_failed: X,
  unknown: CircleHelp,
  error: CircleHelp,
};

function Checking() {
  return (
    <div role="status" className="grid justify-items-center gap-2 text-center">
      <span
        aria-hidden="true"
        className="mb-2 size-16 animate-spin rounded-full border-6 border-fill border-t-primary motion-reduce:animate-none"
      />
      <h1 className="text-[17px] font-semibold">Đang kiểm tra thanh toán</h1>
      <p className="text-[13px] text-muted-foreground">
        Việc này thường mất vài giây.
      </p>
    </div>
  );
}

function OrderLine({ order }: { order: BuyerOrderDetail }) {
  return (
    <div className="mt-6 border-t border-border pt-4 text-left">
      <div className="flex items-center gap-4">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-muted">
          <EventPoster event={order.event} sizes="64px" labeled />
        </div>
        <div className="min-w-0">
          <p className="font-semibold break-words">{order.event.title}</p>
          <p className="text-[13px] break-all text-muted-foreground">
            {order.orderCode}
          </p>
        </div>
      </div>
      <p className="mt-4 flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-muted-foreground">Tổng cộng</span>
        <strong className="text-[17px] font-semibold whitespace-nowrap tabular-nums">
          {money(order.finalAmount)}
        </strong>
      </p>
    </div>
  );
}

/** Một thẻ cho mỗi trạng thái: một nút chính và một liên kết phụ. */
function ResultCard({
  state,
  order,
  error,
  retry,
}: {
  state: ResultState;
  order?: BuyerOrderDetail;
  error?: ReactNode;
  retry?: { run: () => void; busy: boolean };
}) {
  const view = resultView(state);
  const Icon = ICON[state];
  const orderHref = order ? `/buyer/orders/${order.id}` : "/buyer/orders";
  const { primary, secondary } = view;
  return (
    <>
      <section
        data-testid="result-card"
        className="rounded-3xl bg-background p-6 text-center shadow-sheet"
      >
        <span
          className={cn(
            "mx-auto mb-4 flex size-16 items-center justify-center rounded-full",
            TONE[view.tone],
          )}
        >
          <Icon aria-hidden="true" className="size-7" />
        </span>
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight">
          {view.title}
        </h1>
        {view.text && <p className="mt-2 text-muted-foreground">{view.text}</p>}
        {error && <div className="mt-4">{error}</div>}
        {order && <OrderLine order={order} />}
      </section>
      {primary.kind === "retry" ? (
        // Không dùng disabled: trang tự hỏi lại mỗi 3 giây, khóa nút sẽ làm
        // người dùng bàn phím mất tiêu điểm.
        <Button
          size="lg"
          className="w-full"
          aria-disabled={retry?.busy ?? false}
          onClick={() => {
            if (!retry?.busy) retry?.run();
          }}
        >
          {primary.label}
        </Button>
      ) : (
        <Button asChild size="lg" className="w-full">
          <Link href={primary.kind === "order" ? orderHref : "/buyer/orders"}>
            {primary.label}
          </Link>
        </Button>
      )}
      <Link
        href={secondary.href === "order" ? orderHref : secondary.href}
        className="mx-auto flex min-h-11 items-center font-semibold underline underline-offset-4"
      >
        {secondary.label}
      </Link>
    </>
  );
}

function OrderResult({ orderId }: { orderId: string }) {
  const query = useQuery({
    queryKey: ["payment-result", orderId],
    queryFn: async () =>
      BuyerOrderDetailSchema.parse(
        await apiClient<unknown>(`/buyer/orders/${orderId}`),
      ),
    retry: false,
    // Đơn hết hạn vẫn hỏi thưa hơn: xác nhận từ VNPay có thể đến muộn.
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (status === "PENDING") return 3000;
      return status === "EXPIRED" ? 10_000 : false;
    },
  });
  // Thử lại sau lỗi cũng về trạng thái chờ; giữ nguyên thẻ để không mất nút.
  if (query.isPending && query.errorUpdateCount === 0) return <Checking />;
  const order = query.data;
  return (
    <ResultCard
      // Không dùng vnp_ResponseCode hay paymentSuccess trên URL để xác nhận.
      state={
        order
          ? detailedState(
              paymentState(order.status),
              order.status,
              order.refunds,
            )
          : "error"
      }
      order={order}
      error={query.error && <FlowError error={query.error} />}
      retry={{ run: () => void query.refetch(), busy: query.isFetching }}
    />
  );
}

function ResultRoute() {
  const params = useSearchParams();
  const explicitId = params.get("orderId");
  const transactionRef = params.get("vnp_TxnRef");
  // undefined: chưa đọc xong sessionStorage, chưa kết luận được.
  const [returnedId, setReturnedId] = useState<string | null>();
  useEffect(() => {
    let id: string | null = null;
    try {
      const saved: unknown = JSON.parse(
        sessionStorage.getItem("tickethub:payment-return") || "null",
      );
      const parsed = z
        .object({ orderId: z.string().uuid(), transactionRef: z.string() })
        .safeParse(saved);
      if (parsed.success && transactionRef === parsed.data.transactionRef)
        id = parsed.data.orderId;
    } catch {
      /* Người dùng vẫn có thể kiểm tra tại danh sách đơn hàng. */
    }
    queueMicrotask(() => setReturnedId(id));
  }, [transactionRef]);
  if (explicitId === null && returnedId === undefined) return <Checking />;
  const valid = z
    .string()
    .uuid()
    .safeParse(explicitId ?? returnedId);
  if (!valid.success) return <ResultCard state="unknown" />;
  return <OrderResult key={valid.data} orderId={valid.data} />;
}

export default function ResultPage() {
  return (
    <FlowShell
      header={<SiteHeader actions={<HeaderActions />} />}
      className="flex flex-col bg-checkout-page"
      mainClassName="flex w-full max-w-132 flex-1 flex-col justify-center pt-6 pb-8 sm:pt-6"
    >
      <div aria-live="polite" className="flex flex-col gap-4">
        <Suspense fallback={<Checking />}>
          <ResultRoute />
        </Suspense>
      </div>
    </FlowShell>
  );
}
