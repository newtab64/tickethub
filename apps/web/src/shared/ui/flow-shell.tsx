"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { ZodError } from "zod";
import { ApiError } from "@/shared/api/client";
import { cn } from "@/shared/lib/utils";

export function FlowShell({
  title,
  children,
  footer,
  className,
  mainClassName,
  header,
}: {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  mainClassName?: string;
  header: ReactNode;
}) {
  return (
    <div
      className={cn("min-h-screen bg-background text-foreground", className)}
    >
      {header}
      <main
        className={cn(
          "mx-auto max-w-[1248px] px-4 pt-8 pb-12 sm:px-6 sm:pt-10",
          mainClassName,
        )}
      >
        {title && (
          <h1 className="mb-6 text-[28px] font-semibold tracking-tight sm:mb-8">
            {title}
          </h1>
        )}
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
