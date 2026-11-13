"use client";

import type { ReactNode } from "react";
import { Button } from "@/shared/ui/button";
import { operationsError } from "../api/organizer-operations-api";

export const selectClass =
  "h-10 rounded-lg border border-input bg-background px-3 text-sm w-full disabled:opacity-50";
export const panelClass =
  "rounded-xl border border-border bg-background p-5 sm:p-6";
export const vnd = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
export const number = (value: number) =>
  new Intl.NumberFormat("vi-VN").format(value);
export const time = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));

export function QueryMessage({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: unknown;
  retry: () => void;
}) {
  if (loading)
    return (
      <p
        role="status"
        className={`${panelClass} text-sm text-muted-foreground`}
      >
        Đang tải dữ liệu...
      </p>
    );
  if (!error) return null;
  return (
    <div
      role="alert"
      className={`${panelClass} border-destructive/40 space-y-3`}
    >
      <p className="text-sm text-destructive">{operationsError(error)}</p>
      <Button variant="outline" onClick={retry}>
        Thử lại
      </Button>
    </div>
  );
}

export function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className={panelClass}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
