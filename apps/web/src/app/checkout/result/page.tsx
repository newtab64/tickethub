"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { BuyerOrderDetailSchema } from "@tickethub/shared";
import { apiClient } from "@/lib/api/client";
import { money, paymentState } from "@/lib/checkout";
import { FlowShell, FlowError } from "@/components/checkout/flow-shell";
import { Button } from "@/components/ui/button";

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
  return (
    <section
      className="mx-auto max-w-2xl space-y-5 rounded-xl border border-border bg-background p-6"
      aria-live="polite"
    >
      <h2 className="text-xl font-bold">
        {state === "success"
          ? "Thanh toán thành công"
          : state === "processing"
            ? "Đang chờ xác nhận thanh toán"
            : state === "refunded"
              ? "Đơn đã hủy toàn bộ vé"
              : "Đơn hàng chưa được thanh toán thành công"}
      </h2>
      <p className="font-mono">{order.orderCode}</p>
      <p>{order.event.title}</p>
      <p>
        Tổng tiền: <strong>{money(order.finalAmount)}</strong>
      </p>
      {state === "processing" && (
        <p>
          Hệ thống đang chờ xác nhận từ VNPay. Trang sẽ tự kiểm tra lại. Không
          thanh toán thêm nếu tài khoản đã bị trừ tiền.
        </p>
      )}
      {state === "failed" && (
        <p>
          Đơn đã hết hạn, bị hủy hoặc thanh toán thất bại. Nếu đã bị trừ tiền,
          vui lòng liên hệ hỗ trợ kèm mã đơn.
        </p>
      )}
      {state === "refunded" && (
        <p>Theo dõi trạng thái xử lý hoàn tiền tại chi tiết đơn hàng.</p>
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
    <FlowShell title="Kết quả thanh toán">
      <Suspense fallback={<p>Đang tải...</p>}>
        <ResultRoute />
      </Suspense>
    </FlowShell>
  );
}
