import Link from "next/link";
import type { ReactNode } from "react";
import { ReceiptText } from "lucide-react";
import { Logo } from "./logo";

export function FlowShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="px-4 pt-3 sm:px-6">
        <nav
          className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-3 rounded-full border border-border bg-background px-4 shadow-sm sm:px-6"
          aria-label="Điều hướng mua vé"
        >
          <Logo />
          <Link
            href="/buyer/orders"
            className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-xs font-semibold hover:bg-accent hover:text-primary sm:text-sm"
          >
            <ReceiptText className="size-4 shrink-0" aria-hidden="true" />
            Đơn hàng của tôi
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-[1248px] px-4 pt-8 pb-12 sm:px-6 sm:pt-10">
        <h1 className="mb-6 text-2xl font-bold tracking-tight sm:mb-8 sm:text-3xl">
          {title}
        </h1>
        {children}
      </main>
    </div>
  );
}

export function FlowError({ error }: { error: unknown }) {
  return (
    <p
      role="alert"
      className="rounded-xl border border-destructive bg-background p-4 text-destructive"
    >
      {error instanceof Error
        ? error.message
        : "Không thể tải dữ liệu. Vui lòng thử lại."}
    </p>
  );
}
