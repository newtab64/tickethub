import type { ReactNode } from "react";
import Link from "next/link";
import { Ticket } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Logo } from "./logo";

/** Header chung: một viên thuốc, logo bên trái, nội dung do trang ghép vào. */
export function SiteHeader({
  leading,
  logoClassName,
  center,
  actions,
}: {
  /** Đứng trước logo, ví dụ nút Quay lại. */
  leading?: ReactNode;
  logoClassName?: string;
  center?: ReactNode;
  actions: ReactNode;
}) {
  return (
    <header className="px-4 pt-3 sm:px-6">
      <nav
        aria-label="Điều hướng chính"
        className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-4 rounded-full bg-background pr-1.5 pl-4 shadow-sheet sm:pl-6"
      >
        <div className="flex shrink-0 items-center gap-2">
          {leading}
          <Logo className={logoClassName} />
        </div>
        {center && <div className="min-w-0 flex-1">{center}</div>}
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      </nav>
    </header>
  );
}

export function MyTicketsLink({
  current = false,
  className,
}: {
  current?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/buyer/orders"
      aria-label="Vé của tôi"
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex size-11 items-center justify-center gap-2 rounded-full text-[15px] font-semibold transition-colors motion-reduce:transition-none sm:w-auto sm:px-4",
        current
          ? "bg-foreground text-background"
          : "bg-fill hover:bg-fill-hover",
        className,
      )}
    >
      <Ticket aria-hidden="true" className="size-4.5" />
      <span className="hidden sm:inline">Vé của tôi</span>
    </Link>
  );
}
