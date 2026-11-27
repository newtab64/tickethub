"use client";

import { ChevronRight } from "lucide-react";
import type { BuyerOrderDetail } from "@tickethub/shared";
import { EventPoster, formatEventDateTime } from "@/features/event";
import { canShowQr, listedTickets, seatDetail } from "../domain/ticket-qr";
import type { Refund } from "./use-refund";

const ROW =
  "flex min-h-20 w-full items-center gap-4 px-5 py-4 text-left sm:px-6";

/** Thẻ chính: ảnh và thông tin sự kiện, mỗi vé một dòng. */
export function OrderTicketsCard({
  order,
  refund,
  onShow,
}: {
  order: BuyerOrderDetail;
  refund: Refund;
  onShow: (ticketId: string) => void;
}) {
  const { event } = order;
  return (
    <article className="overflow-hidden rounded-3xl bg-background">
      <div className="relative aspect-[16/9] bg-muted sm:aspect-[5/2]">
        <EventPoster
          event={event}
          sizes="(min-width: 528px) 480px, 100vw"
          labeled
        />
      </div>
      <div className="space-y-2 p-5 sm:p-6">
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-balance break-words">
          {event.title}
        </h1>
        <p className="text-[15px] text-muted-foreground">
          {formatEventDateTime(event.startTime)}
          <br />
          {event.venueName}, {event.city}
        </p>
      </div>
      <ul aria-label="Vé của bạn">
        {listedTickets(order).map((ticket) => {
          const text = (
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-semibold break-words">
                {ticket.ticketTypeName}
              </span>
              <span className="block text-[15px] text-muted-foreground">
                {seatDetail(ticket)}
              </span>
              {ticket.status === "CHECKED_IN" && (
                <span className="block text-[13px] text-muted-foreground">
                  Đã vào cổng
                </span>
              )}
            </span>
          );
          const refundable =
            order.status === "PAID" && ticket.status === "SOLD";
          return (
            <li
              key={ticket.id}
              data-testid="order-ticket"
              className="border-t border-border"
            >
              {refund.active ? (
                <label
                  className={`${ROW} ${refundable ? "cursor-pointer has-checked:bg-muted" : "opacity-50"}`}
                >
                  <input
                    type="checkbox"
                    className="size-5.5 shrink-0 accent-primary"
                    disabled={!refundable || refund.busy}
                    checked={refund.selected.includes(ticket.id)}
                    onChange={(e) => refund.toggle(ticket.id, e.target.checked)}
                  />
                  {text}
                </label>
              ) : canShowQr(ticket, event.status) ? (
                <button
                  type="button"
                  className={`${ROW} cursor-pointer hover:bg-muted focus-visible:-outline-offset-4`}
                  onClick={() => onShow(ticket.id)}
                >
                  {text}
                  <ChevronRight
                    aria-hidden="true"
                    className="size-5 shrink-0 text-muted-foreground"
                  />
                </button>
              ) : (
                <div className={ROW}>{text}</div>
              )}
            </li>
          );
        })}
      </ul>
    </article>
  );
}
