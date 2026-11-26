import type { CheckoutOrder } from "@tickethub/shared";
import { EventPoster } from "@/features/event";
import { cn } from "@/shared/lib/utils";
import { dateTime, money, seatRows } from "../domain/order-checkout";
import { CheckoutCell, checkoutGroup } from "./checkout-cell";

/** Nửa trái: sự kiện, ghế đã cấp, chi phí và tổng tiền. */
export function OrderSummary({ order }: { order: CheckoutOrder }) {
  const rows = seatRows(order.items);
  const tickets = order.items.reduce((sum, item) => sum + item.quantity, 0);
  // Quá hai dòng thì cuộn trong khung để hai nửa không bị kéo giãn.
  const scrolls = rows.length > 2;
  const place = [order.event.venueName, order.event.city]
    .filter(Boolean)
    .join(", ");
  return (
    <aside
      aria-label="Tóm tắt đơn hàng"
      className="contents lg:row-span-4 lg:grid lg:grid-rows-subgrid"
    >
      <CheckoutCell title="Sự kiện" className="order-1">
        <div className={cn(checkoutGroup, "flex-row divide-y-0")}>
          <div className="relative min-h-35 w-26 shrink-0 self-stretch bg-muted lg:min-h-0 lg:w-50">
            <EventPoster
              event={order.event}
              sizes="(min-width: 1024px) 200px, 104px"
              labeled
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 px-3.5 py-3 lg:px-5">
            <h3 className="text-base leading-snug font-bold tracking-tight break-words lg:text-lg">
              {order.event.title}
            </h3>
            <time
              dateTime={order.event.startTime}
              className="text-[13px] font-semibold tabular-nums"
            >
              {dateTime(order.event.startTime)}
            </time>
            <p className="text-[13px] break-words text-muted-foreground">
              {place}
            </p>
          </div>
        </div>
      </CheckoutCell>
      <CheckoutCell
        title="Ghế của bạn"
        note={`${tickets} vé`}
        className="order-2"
      >
        <ul
          className={cn(
            checkoutGroup,
            scrolls && "max-h-[9.9rem] overflow-y-auto short:max-h-[8.75rem]",
          )}
          {...(scrolls && { tabIndex: 0, "aria-label": "Danh sách ghế" })}
        >
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex min-h-17 flex-[1_0_auto] items-center gap-3.5 px-4 short:min-h-[4.25rem]"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-accent text-lg font-bold text-accent-foreground tabular-nums short:size-10">
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
              <span className="shrink-0 tabular-nums">{money(row.amount)}</span>
            </li>
          ))}
        </ul>
      </CheckoutCell>
      <CheckoutCell title="Chi phí" note={order.orderCode} className="order-6">
        <dl className="flex min-h-13 flex-wrap items-center justify-between gap-x-3 rounded-xl border border-border px-4 py-1 tabular-nums short:min-h-11.5">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Tạm tính</dt>
            <dd className="font-semibold">{money(order.totalAmount)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Giảm giá</dt>
            <dd className="font-semibold">{money(order.discountAmount)}</dd>
          </div>
        </dl>
      </CheckoutCell>
      <CheckoutCell className="order-7 justify-end">
        <p
          data-testid="checkout-total"
          className="flex h-15 items-center justify-between gap-3 rounded-xl bg-muted pr-4 pl-5 font-semibold short:h-13"
        >
          <span>Tổng thanh toán</span>
          <strong
            data-testid="checkout-total-amount"
            className="text-2xl font-bold tracking-tight whitespace-nowrap tabular-nums lg:text-[28px]"
          >
            {money(order.finalAmount)}
          </strong>
        </p>
      </CheckoutCell>
    </aside>
  );
}
