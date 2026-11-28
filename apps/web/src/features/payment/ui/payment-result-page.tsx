"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CircleCheck, CircleX, Clock3, RotateCcw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { BuyerOrderDetailSchema } from "@tickethub/shared";
import { apiClient } from "@/shared/api/client";
import { money, paymentState } from "../domain/order-checkout";
import { HeaderActions } from "@/features/identity";
import { SiteHeader } from "@/shared/ui/site-header";
import { FlowShell, FlowError } from "@/shared/ui/flow-shell";
import { Button } from "@/shared/ui/button";

function OrderResult({ orderId }: { orderId: string }) {
  const query = useQuery({
    queryKey: ["payment-result", orderId],
    queryFn: async () =>
      BuyerOrderDetailSchema.parse(
        await apiClient<unknown>(`/buyer/orders/${orderId}`),
      ),
    retry: false,
    refetchInterval: (q) => (q.state.data?.status === "PENDING" ? 3000 : false),
  });
  if (query.isPending)
    return <p role="status">Đang kiểm tra thanh toán với hệ thống...</p>;
  const order = query.data;
  if (!order)
    return (
      <>
        <FlowError error={query.error} />
        <Button className="mt-4" onClick={() => query.refetch()}>
          Kiểm tra lại
        </Button>
      </>
    );
  const state = paymentState(order.status);
  const StatusIcon =
    state === "success"
      ? CircleCheck
      : state === "failed"
        ? CircleX
        : state === "processing"
          ? Clock3
          : RotateCcw;
  return (
    <section
      className="max-w-2xl space-y-5 rounded-xl border border-border bg-background p-5 sm:p-7"
      aria-live="polite"
    >
      <h2 className="flex items-center gap-3 text-xl font-bold tracking-tight">
        <StatusIcon
          aria-hidden="true"
          className={
            state === "failed"
              ? "size-6 shrink-0 text-destructive"
              : state === "success"
                ? "size-6 shrink-0 text-success"
                : "size-6 shrink-0 text-primary"
          }
        />
        {state === "success"
          ? "Thanh toán thành công"
          : state === "processing"
            ? "Đang chờ xác nhận thanh toán"
            : state === "refunded"
              ? "Đơn đã hủy toàn bộ vé"
              : state === "refund_pending"
                ? "Đang chờ hoàn tiền"
                : "Đơn hàng chưa được thanh toán thành công"}
      </h2>
      <div className="space-y-2 rounded-xl bg-muted p-4">
        <p className="text-xs text-muted-foreground">{order.orderCode}</p>
        <p className="font-semibold">{order.event.title}</p>
        <p className="flex flex-wrap justify-between gap-2 text-sm">
          Tổng thanh toán{" "}
          <strong className="tabular-nums">{money(order.finalAmount)}</strong>
        </p>
      </div>
      {state === "processing" && (
        <p>
          Trang sẽ tự cập nhật khi VNPay xác nhận. Nếu đã bị trừ tiền, bạn đừng
          thanh toán lại.
        </p>
      )}
      {state === "failed" && (
        <p>Nếu đã bị trừ tiền, hãy liên hệ hỗ trợ và gửi kèm mã đơn.</p>
      )}
      {(state === "refunded" || state === "refund_pending") && (
        <p>Bạn có thể xem tiến độ hoàn tiền trong chi tiết đơn.</p>
      )}
      {query.error && <FlowError error={query.error} />}
      <div className="flex flex-wrap gap-4">
        <Link
          className="font-semibold text-primary underline"
          href={`/buyer/orders/${order.id}`}
        >
          Xem chi tiết đơn hàng
        </Link>
        <Link className="underline" href="/buyer/orders">
          Đơn hàng của tôi
        </Link>
      </div>
      <Button
        variant="outline"
        disabled={query.isFetching}
        onClick={() => query.refetch()}
      >
        Kiểm tra lại trạng thái
      </Button>
    </section>
  );
}

function ResultRoute() {
  const params = useSearchParams();
  const explicitId = params.get("orderId");
  const transactionRef = params.get("vnp_TxnRef");
  const [returnedId, setReturnedId] = useState<string | null>(null);
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
  const valid = z
    .string()
    .uuid()
    .safeParse(explicitId ?? returnedId);
  if (!valid.success)
    return (
      <p>
        Không xác định được đơn hàng từ lần thanh toán này.{" "}
        <Link className="text-primary underline" href="/buyer/orders">
          Kiểm tra đơn hàng của tôi
        </Link>
        .
      </p>
    );
  // Không dùng vnp_ResponseCode hoặc paymentSuccess trên URL để xác nhận trả tiền.
  return <OrderResult key={valid.data} orderId={valid.data} />;
}
export default function ResultPage() {
  return (
    <FlowShell
      title="Kết quả thanh toán"
      header={<SiteHeader actions={<HeaderActions />} />}
    >
      <Suspense fallback={<p>Đang tải...</p>}>
        <ResultRoute />
      </Suspense>
    </FlowShell>
  );
}
