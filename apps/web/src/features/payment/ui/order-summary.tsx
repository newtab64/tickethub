import type { CheckoutOrder } from "@tickethub/shared";
import { EventPoster } from "@/features/event";
import { cn } from "@/shared/lib/utils";
import { dateTime, money, seatRows } from "../domain/order-checkout";

const LINE = "flex justify-between gap-3 text-[13px] text-muted-foreground";

/** Nửa trái: sự kiện, ghế đã cấp và số tiền phải trả. */
export function OrderSummary({ order }: { order: CheckoutOrder }) {
  const rows = seatRows(order.items);
  // Quá hai dòng thì cuộn trong khung để thẻ không bị kéo dài.
  const scrolls = rows.length > 2;
  const place = [order.event.venueName, order.event.city]
    .filter(Boolean)
    .join(", ");
  return (
    // Điện thoại tách các khối ra để xen với nửa phải theo luồng mua.
    <aside
      aria-label="Tóm tắt đơn hàng"
      className="contents lg:flex lg:min-w-0 lg:flex-col lg:p-8 short:lg:p-6"
    >
      <div className="order-1 flex items-center gap-4 px-5 pt-6 pb-4 lg:p-0 lg:pb-6 short:lg:pb-4">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-muted">
          <EventPoster event={order.event} sizes="80px" labeled />
        </div>
        <div className="min-w-0">
          <h2 className="text-[17px] leading-snug font-semibold break-words">
            {order.event.title}
          </h2>
          <p className="text-[13px] text-muted-foreground tabular-nums">
            <time dateTime={order.event.startTime}>
              {dateTime(order.event.startTime)}
            </time>
          </p>
          <p className="text-[13px] break-words text-muted-foreground">
            {place}
          </p>
        </div>
      </div>
      <div className="order-2 px-5 lg:p-0">
        <ul
          className={cn(
            scrolls &&
              // Ghế thứ ba ló một phần để thấy là còn cuộn được.
              "lg:max-h-48 lg:overflow-y-auto short:lg:max-h-[9.5rem]",
          )}
          {...(scrolls && { tabIndex: 0, "aria-label": "Danh sách ghế" })}
        >
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex justify-between gap-4 border-t border-border py-4 max-[359px]:gap-2 short:lg:py-2"
            >
              <span className="min-w-0">
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
      </div>
      <div className="order-5 px-5 py-4 lg:mt-auto lg:p-0">
        <div
          data-testid="checkout-total"
          className="border-t border-border pt-4 tabular-nums"
        >
          {order.discountAmount > 0 && (
            <dl className="mb-2 space-y-1">
              <div className={LINE}>
                <dt>Tạm tính</dt>
                <dd>{money(order.totalAmount)}</dd>
              </div>
              <div className={LINE}>
                <dt>Giảm giá</dt>
                <dd>{money(order.discountAmount)}</dd>
              </div>
            </dl>
          )}
          <p className="flex flex-wrap items-baseline justify-between gap-x-3 max-[359px]:gap-x-2">
            <span
              data-total-label
              className="text-[17px] font-semibold whitespace-nowrap"
            >
              Tổng cộng
            </span>
            <strong
              data-testid="checkout-total-amount"
              className="text-[28px] leading-tight font-semibold tracking-tight whitespace-nowrap max-[359px]:text-[17px]"
            >
              {money(order.finalAmount)}
            </strong>
          </p>
          <p className="text-[13px] text-muted-foreground">Đã gồm VAT</p>
        </div>
      </div>
    </aside>
  );
}
