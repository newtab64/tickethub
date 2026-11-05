import Link from "next/link";
import type { ReactNode } from "react";

export function FlowShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted text-foreground">
      <header className="border-b border-border bg-background px-4 py-4">
        <nav
          className="mx-auto flex max-w-6xl items-center justify-between gap-4"
          aria-label="Điều hướng mua vé"
        >
          <Link href="/" className="text-xl font-extrabold text-primary">
            TicketHub
          </Link>
          <Link href="/buyer/orders" className="text-sm underline">
            Đơn hàng của tôi
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 text-2xl font-extrabold">{title}</h1>
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
