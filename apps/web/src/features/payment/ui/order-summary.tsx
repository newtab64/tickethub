import type { CheckoutOrder } from "@tickethub/shared";
import { EventPoster } from "@/features/event";
import { cn } from "@/shared/lib/utils";
import { dateTime, money, seatRows } from "../domain/order-checkout";
import { CheckoutCell } from "./checkout-cell";

/** Nửa trái: sự kiện, ghế đã cấp và số tiền phải trả. */
export function OrderSummary({ order }: { order: CheckoutOrder }) {
  const rows = seatRows(order.items);
  // Quá hai dòng thì cuộn trong khung để hai nửa không bị kéo giãn.
  const scrolls = rows.length > 2;
  const place = [order.event.venueName, order.event.city]
    .filter(Boolean)
    .join(", ");
  return (
    <aside
      aria-label="Tóm tắt đơn hàng"
      className="contents lg:row-span-3 lg:grid lg:grid-rows-subgrid"
    >
      <CheckoutCell title="Sự kiện" className="order-1">
        <div className="flex items-center gap-5">
          <div className="relative size-21 shrink-0 overflow-hidden rounded-lg bg-muted lg:h-24 lg:w-32 short:h-20">
            <EventPoster
              event={order.event}
              sizes="(min-width: 1024px) 128px, 84px"
              labeled
            />
          </div>
          <div className="min-w-0">
            <h3 className="mb-1.5 text-[17px] leading-snug font-bold tracking-tight break-words lg:text-xl">
              {order.event.title}
            </h3>
            <p className="text-muted-foreground tabular-nums">
              <time dateTime={order.event.startTime}>
                {dateTime(order.event.startTime)}
              </time>
            </p>
            <p className="break-words text-muted-foreground">{place}</p>
          </div>
        </div>
      </CheckoutCell>
      <CheckoutCell title="Ghế của bạn" className="order-2">
        <ul
          className={cn(
            scrolls && "lg:max-h-32 lg:overflow-y-auto short:max-h-[6.5rem]",
          )}
          {...(scrolls && { tabIndex: 0, "aria-label": "Danh sách ghế" })}
        >
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-4 py-2.5 max-[359px]:gap-2 short:py-1.5"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-base font-bold text-accent-foreground tabular-nums max-[359px]:size-9 short:size-10">
                {row.badge}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold break-words">
                  {row.title}
                </span>
                <span className="block text-[13px] text-muted-foreground">
                  {row.detail}
                </span>
              </span>
              <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">
                {money(row.amount)}
              </span>
            </li>
          ))}
        </ul>
      </CheckoutCell>
      <CheckoutCell className="order-5 justify-end">
        <div
          data-testid="checkout-total"
          className="border-t border-border pt-5 tabular-nums short:pt-2"
        >
          <dl className="mb-1.5 space-y-1.5 text-muted-foreground short:mb-0">
            <div className="flex justify-between gap-3">
              <dt>Tạm tính</dt>
              <dd>{money(order.totalAmount)}</dd>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between gap-3">
                <dt>Giảm giá</dt>
                <dd>{money(order.discountAmount)}</dd>
              </div>
            )}
          </dl>
          <p className="flex h-14 items-center justify-between gap-3 font-semibold max-[359px]:gap-2 max-[359px]:text-[13px] short:h-12">
            <span>Tổng thanh toán</span>
            <strong
              data-testid="checkout-total-amount"
              className="text-[30px] font-bold tracking-tight whitespace-nowrap max-[399px]:text-2xl max-[359px]:text-lg"
            >
              {money(order.finalAmount)}
            </strong>
          </p>
        </div>
      </CheckoutCell>
    </aside>
  );
}
