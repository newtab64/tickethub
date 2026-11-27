import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/**
 * Một khối trong thẻ thanh toán. Trên desktop mỗi cặp khối trái phải chung một
 * hàng lưới; trên mobile `className` quyết định thứ tự theo luồng mua.
 */
export function CheckoutCell({
  title,
  className,
  children,
}: {
  title?: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col px-5 py-4 lg:order-none lg:px-12 short:py-2",
        className,
      )}
    >
      {title && (
        <h2 className="mb-4 text-[13px] font-semibold text-muted-foreground short:mb-2">
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}
