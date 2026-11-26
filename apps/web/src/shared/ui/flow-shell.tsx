"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { ReceiptText } from "lucide-react";
import { ZodError } from "zod";
import { ApiError } from "@/shared/api/client";
import { Logo } from "./logo";

export function FlowShell({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
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
      {footer}
    </div>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ZodError)
    return "Máy chủ trả về dữ liệu không hợp lệ. Vui lòng thử lại sau.";
  return error instanceof Error
    ? error.message
    : "Không thể tải dữ liệu. Vui lòng thử lại.";
}

export function FlowError({ error }: { error: unknown }) {
  const router = useRouter();
  const unauthorized = error instanceof ApiError && error.status === 401;
  // apiClient đã thử làm mới token: còn 401 thì phải đăng nhập lại.
  useEffect(() => {
    if (!unauthorized) return;
    const current = window.location.pathname + window.location.search;
    router.replace(`/auth?redirect=${encodeURIComponent(current)}`);
  }, [unauthorized, router]);

  return (
    <p
      role="alert"
      className="rounded-xl border border-destructive bg-background p-4 text-destructive"
    >
      {errorMessage(error)}
    </p>
  );
}
