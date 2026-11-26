import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/** Khung bo góc chứa các dòng của một khối. */
export const checkoutGroup =
  "flex flex-1 flex-col divide-y divide-border overflow-hidden rounded-xl border border-border";

/**
 * Một khối trong thẻ thanh toán. Trên desktop mỗi cặp khối trái phải chung một
 * hàng lưới; trên mobile `className` quyết định thứ tự theo luồng mua.
 */
export function CheckoutCell({
  title,
  note,
  className,
  children,
}: {
  title?: string;
  note?: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col px-4 py-2.5 lg:order-none lg:px-8 lg:py-3 short:py-2",
        className,
      )}
    >
      {title && (
        <div className="mb-2.5 flex h-5 items-center justify-between gap-3 short:mb-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          {note && (
            <p className="text-[13px] font-medium text-muted-foreground tabular-nums">
              {note}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
