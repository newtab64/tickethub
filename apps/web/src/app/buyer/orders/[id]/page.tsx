"use client";

import { use, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BuyerOrderDetailSchema,
  RefundPreviewResponseSchema,
  RefundExecuteRequestSchema,
  RefundExecuteResponseSchema,
  type RefundPreviewResponse,
  type RefundExecuteRequest,
} from "@tickethub/shared";
import { apiClient, ApiError } from "@/lib/api/client";
import {
  money,
  dateTime,
  orderStatusLabel,
  ticketStatusLabel,
  refundPolicyLabel,
  refundStatusLabel,
} from "@/lib/checkout";
import { FlowShell, FlowError } from "@/components/checkout/flow-shell";
import { Button } from "@/components/ui/button";

function OrderDetail({ id }: { id: string }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<RefundPreviewResponse | null>(null);
  const [notice, setNotice] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const pendingRequest = useRef<{
    key: string;
    body: RefundExecuteRequest;
  } | null>(null);
  const query = useQuery({
    queryKey: ["buyer-order", id],
    queryFn: async () =>
      BuyerOrderDetailSchema.parse(
        await apiClient<unknown>(`/buyer/orders/${encodeURIComponent(id)}`),
      ),
    retry: false,
  });
  const previewMutation = useMutation({
    mutationFn: async () =>
      RefundPreviewResponseSchema.parse(
        await apiClient<unknown>("/refund/preview", {
          method: "POST",
          body: JSON.stringify({ orderId: id, ticketIds: selected }),
        }),
      ),
    onSuccess: (data) => {
      setPreview(data);
      setNotice("");
    },
  });
  const refund = useMutation({
    mutationFn: async () => {
      if (!preview || preview.totalRefundAmount <= 0)
        throw new Error("Vui lòng xem trước số tiền hoàn trước khi xác nhận.");
      if (!pendingRequest.current)
        pendingRequest.current = {
          key: crypto.randomUUID(),
          body: RefundExecuteRequestSchema.parse({
            orderId: id,
            ticketIds: selected,
            reason: reason.trim(),
          }),
        };
      const pending = pendingRequest.current;
      return RefundExecuteResponseSchema.parse(
        await apiClient<unknown>("/refund/request", {
          method: "POST",
          headers: { "Idempotency-Key": pending.key },
          body: JSON.stringify(pending.body),
        }),
      );
    },
    onSuccess: (data) => {
      setNotice(
        `Đã tiếp nhận yêu cầu hủy ${data.cancelledTicketCount} vé, số tiền hoàn ${money(data.refundAmount)}. Tiền hoàn đang được xử lý.`,
      );
      pendingRequest.current = null;
      setUncertain(false);
      setSelected([]);
      setPreview(null);
      setReason("");
      void query.refetch();
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500
      ) {
        pendingRequest.current = null;
        setUncertain(false);
        setPreview(null);
        void query.refetch();
      } else if (pendingRequest.current) setUncertain(true);
    },
  });
  const order = query.data;
  const busy = previewMutation.isPending || refund.isPending || uncertain;
  return (
    <>
      {query.isPending && <p role="status">Đang tải đơn hàng...</p>}
      {query.error && (
        <>
          <FlowError error={query.error} />
          <Button className="mt-4" onClick={() => query.refetch()}>
            Thử lại
          </Button>
        </>
      )}
      {order && (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <section className="space-y-4 rounded-xl border border-border bg-background p-6">
            <h2 className="text-xl font-bold">{order.event.title}</h2>
            <p className="font-mono">{order.orderCode}</p>
            <p>{orderStatusLabel[order.status]}</p>
            <p>{dateTime(order.event.startTime)}</p>
            <p>
              {order.event.venueName} · {order.event.city}
            </p>
            <ul className="divide-y divide-border">
              {order.items.map((item) => (
                <li key={item.id} className="py-3">
                  {item.ticketTypeName} × {item.quantity}{" "}
                  <span className="float-right">{money(item.subtotal)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt>Tạm tính</dt>
                <dd>{money(order.totalAmount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Giảm giá</dt>
                <dd>{money(order.discountAmount)}</dd>
              </div>
              <div className="flex justify-between font-bold">
                <dt>Tổng thanh toán</dt>
                <dd>{money(order.finalAmount)}</dd>
              </div>
            </dl>
            {order.status === "PENDING" && (
              <Link
                className="block text-primary underline"
                href={`/checkout?orderId=${id}`}
              >
                Tiếp tục thanh toán
              </Link>
            )}
            <Link className="block underline" href="/buyer/orders">
              Về danh sách đơn hàng
            </Link>
            {order.refunds.length > 0 && (
              <>
                <h3 className="font-bold">Lịch sử hoàn tiền</h3>
                <ul className="space-y-3">
                  {order.refunds.map((item) => (
                    <li key={item.id} className="rounded-lg bg-muted p-3">
                      <p>
                        {money(item.amount)} · {refundStatusLabel(item.status)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {dateTime(item.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-muted-foreground">
                  Hủy vé và hoàn tiền là hai bước riêng. Trạng thái hoàn tiền
                  được cập nhật sau khi xử lý với cổng thanh toán.
                </p>
              </>
            )}
          </section>
          <section
            className="space-y-4 rounded-xl border border-border bg-background p-6"
            aria-label="Hủy vé và hoàn tiền"
          >
            <h2 className="text-lg font-bold">Vé trong đơn hàng</h2>
            {order.tickets.length === 0 && (
              <p>
                Vé sẽ xuất hiện sau khi hệ thống xác nhận thanh toán thành công.
              </p>
            )}
            <fieldset disabled={busy} className="space-y-3">
              <legend className="mb-3 text-sm text-muted-foreground">
                Chọn vé muốn hủy để xem chính sách và số tiền hoàn.
              </legend>
              {order.tickets.map((ticket) => (
                <label
                  key={ticket.id}
                  className="flex items-start gap-3 rounded-xl border border-border p-4"
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    disabled={
                      order.status !== "PAID" || ticket.status !== "SOLD"
                    }
                    checked={selected.includes(ticket.id)}
                    onChange={(e) => {
                      setSelected((current) =>
                        e.target.checked
                          ? [...current, ticket.id]
                          : current.filter((value) => value !== ticket.id),
                      );
                      setPreview(null);
                      previewMutation.reset();
                      refund.reset();
                    }}
                  />
                  <span className="space-y-1">
                    <span className="block font-semibold">
                      {ticket.ticketTypeName}
                    </span>
                    <span className="block text-sm">
                      {ticket.seatInfo.formattedLabel}
                    </span>
                    <span className="block font-mono text-xs break-all">
                      {ticket.ticketCode}
                    </span>
                    <span className="block text-sm">
                      {money(ticket.effectivePaidPrice)} ·{" "}
                      {ticketStatusLabel[ticket.status]}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
            <Button
              variant="outline"
              disabled={selected.length === 0 || busy}
              onClick={() => {
                setPreview(null);
                previewMutation.mutate();
              }}
            >
              {previewMutation.isPending
                ? "Đang tính số tiền hoàn..."
                : "Xem trước số tiền hoàn"}
            </Button>
            {previewMutation.error && (
              <FlowError error={previewMutation.error} />
            )}
            {preview && (
              <div className="space-y-3 rounded-xl bg-muted p-4">
                <h3 className="font-bold">
                  Chính sách {refundPolicyLabel[preview.policyType]}
                </h3>
                <p>Tỷ lệ hoàn: {preview.refundPercentage}%</p>
                <ul className="space-y-2">
                  {preview.items.map((item) => (
                    <li key={item.ticketId}>
                      <p>{item.seatLabel}</p>
                      <p>
                        Hoàn {money(item.refundAmount)} · Khấu trừ{" "}
                        {money(item.feeDeducted)}
                      </p>
                    </li>
                  ))}
                </ul>
                <p>Phí khấu trừ: {money(preview.totalFeeDeducted)}</p>
                <p className="font-bold">
                  Tổng tiền hoàn: {money(preview.totalRefundAmount)}
                </p>
                {preview.totalRefundAmount === 0 && (
                  <p>
                    Vé đã chọn không đủ điều kiện hoàn tiền theo chính sách hiện
                    tại.
                  </p>
                )}
                <label className="block">
                  Lý do hủy
                  <textarea
                    className="mt-2 w-full rounded-lg border border-input bg-background p-3"
                    maxLength={500}
                    value={reason}
                    disabled={busy}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <p className="text-sm">
                  Xác nhận sẽ thu hồi các vé đã chọn. Các vé còn lại vẫn có hiệu
                  lực.
                </p>
                <Button
                  disabled={
                    refund.isPending ||
                    !reason.trim() ||
                    preview.totalRefundAmount <= 0
                  }
                  onClick={() => refund.mutate()}
                >
                  {refund.isPending
                    ? "Đang gửi yêu cầu..."
                    : uncertain
                      ? "Gửi lại cùng yêu cầu"
                      : "Xác nhận hủy vé"}
                </Button>
              </div>
            )}
            {refund.error && <FlowError error={refund.error} />}
            {uncertain && (
              <p role="alert">
                Chưa xác nhận được kết quả. Gửi lại cùng yêu cầu để tránh tạo
                yêu cầu hoàn tiền trùng.
              </p>
            )}
            {notice && (
              <p
                role="status"
                className="rounded-xl bg-accent p-4 text-accent-foreground"
              >
                {notice}
              </p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <FlowShell title="Chi tiết đơn hàng">
      {BuyerOrderDetailSchema.shape.id.safeParse(id).success ? (
        <OrderDetail key={id} id={id} />
      ) : (
        <p role="alert">Mã đơn hàng không hợp lệ.</p>
      )}
    </FlowShell>
  );
}
