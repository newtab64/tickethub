"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { BuyerOrderDetail } from "@tickethub/shared";
import {
  dateTime,
  money,
  orderStatusLabel,
  refundStatusLabel,
} from "@/features/payment";
import { groupOrderItems, seatDetail } from "../domain/ticket-qr";
import type { Refund } from "./use-refund";

const LINE = "flex justify-between gap-4 border-t border-border py-2";
const LINK =
  "flex min-h-11 w-full cursor-pointer items-center justify-center rounded-full px-4 text-[13px] font-semibold hover:bg-muted";

/** Phan thu gon: tien, ma don, hoan tien va loi vao hoan ve. */
export function OrderDetails({
  order,
  refund,
}: {
  order: BuyerOrderDetail;
  refund: Refund;
}) {
  const cancelled = order.tickets.filter((t) => t.status === "CANCELLED");
  const refundable =
    order.status === "PAID" && order.tickets.some((t) => t.status === "SOLD");
  return (
    <details className="group overflow-hidden rounded-3xl bg-background">
      <summary className="flex h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 hover:bg-muted focus-visible:-outline-offset-4 sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="text-[15px] font-semibold">Chi tiết đơn</span>
        <span className="flex items-center gap-2 text-[15px] text-muted-foreground tabular-nums">
          {money(order.finalAmount)}
          <span className="flex size-8 items-center justify-center rounded-full bg-fill text-foreground transition-transform group-open:rotate-180 group-hover:bg-fill-hover motion-reduce:transition-none">
            <ChevronDown aria-hidden="true" className="size-4.5 stroke-[2.5]" />
          </span>
        </span>
      </summary>
      <div className="space-y-2 px-5 pb-4 sm:px-6">
        <dl className="text-[13px] tabular-nums">
          {groupOrderItems(order.items).map((item) => (
            <div key={item.key} className={LINE}>
              <dt className="text-muted-foreground">
                {item.name}, {item.quantity} vé
              </dt>
              <dd>{money(item.subtotal)}</dd>
            </div>
          ))}
          {order.discountAmount > 0 && (
            <div className={LINE}>
              <dt className="text-muted-foreground">Giảm giá</dt>
              <dd>-{money(order.discountAmount)}</dd>
            </div>
          )}
          <div className={`${LINE} font-semibold`}>
            <dt>Tổng thanh toán</dt>
            <dd>{money(order.finalAmount)}</dd>
          </div>
          <div className={LINE}>
            <dt className="text-muted-foreground">Trạng thái</dt>
            <dd>{orderStatusLabel[order.status]}</dd>
          </div>
          <div className={LINE}>
            <dt className="text-muted-foreground">Mã đơn</dt>
            <dd className="break-all">{order.orderCode}</dd>
          </div>
          {cancelled.map((ticket) => (
            <div key={ticket.id} className={LINE}>
              <dt className="text-muted-foreground">Vé đã hủy</dt>
              <dd className="text-right">
                {ticket.ticketTypeName}, {seatDetail(ticket)}
              </dd>
            </div>
          ))}
          {order.refunds.map((item) => (
            <div key={item.id} className={LINE}>
              <dt className="text-muted-foreground">
                Hoàn tiền {dateTime(item.createdAt)}
              </dt>
              <dd className="text-right">
                {money(item.amount)} · {refundStatusLabel(item.status)}
              </dd>
            </div>
          ))}
        </dl>
        {order.refunds.length > 0 && (
          <p className="text-[13px] text-muted-foreground">
            Hủy vé và hoàn tiền là hai bước riêng. Trạng thái hoàn tiền được cập
            nhật sau khi xử lý với cổng thanh toán.
          </p>
        )}
        {refundable &&
          (refund.active ? (
            <button
              type="button"
              className={LINK}
              disabled={refund.busy}
              onClick={() => refund.setActive(false)}
            >
              Thôi, giữ vé
            </button>
          ) : (
            <button
              type="button"
              className={`${LINK} text-destructive`}
              onClick={() => refund.setActive(true)}
            >
              Yêu cầu hoàn vé
            </button>
          ))}
        <Link href="/buyer/orders" className={LINK}>
          Về danh sách đơn hàng
        </Link>
      </div>
    </details>
  );
}
