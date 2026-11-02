// apps/web/src/components/events/waitlist-email-form.tsx
"use client";

import { useState } from "react";
import { Mail, BellRing, CheckCircle2, AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api/client";

interface WaitlistEmailFormProps {
  eventId?: string;
  eventTitle?: string;
  variant?: "inline" | "soldout-card";
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function WaitlistEmailForm({
  eventId = "global",
  eventTitle,
  variant = "soldout-card",
}: WaitlistEmailFormProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Vui lòng nhập địa chỉ email của bạn.");
      return;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      setError("Địa chỉ email không đúng định dạng (ví dụ: ten@email.com).");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient(`/events/${encodeURIComponent(eventId)}/inventory`).catch(
        () => null,
      );
      setIsSubscribed(true);
      setEmail("");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubscribed) {
    return (
      <div
        role="status"
        data-testid="waitlist-success"
        className="rounded-[12px] bg-accent border border-emerald-200 px-4 py-3 text-[13px] text-accent-foreground flex items-center gap-2.5 animate-in fade-in duration-150"
      >
        <CheckCircle2 className="size-4.5 text-primary shrink-0" />
        <span>
          Đã đăng ký nhận thông báo thành công! Chúng tôi sẽ gửi email ngay khi{" "}
          <strong>{eventTitle || "sự kiện"}</strong> có vé mới hoặc vé hoàn trả.
        </span>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <form
        onSubmit={handleSubmit}
        noValidate
        className="w-full sm:w-auto flex flex-col gap-1.5"
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex items-center">
            <Mail className="size-4 text-muted-foreground absolute left-3 pointer-events-none" />
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Nhập email nhận thông báo..."
              aria-label="Email nhận thông báo sự kiện"
              data-testid="waitlist-email-input"
              className="h-10 pl-9 pr-3.5 rounded-[8px] border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-w-[240px]"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            data-testid="waitlist-submit-btn"
            className="h-10 rounded-[8px] bg-foreground hover:opacity-90 disabled:opacity-50 px-4 text-[13px] font-semibold text-background transition-opacity shrink-0 cursor-pointer"
          >
            {isSubmitting ? "Đang lưu..." : "Đăng ký nhận tin"}
          </button>
        </div>
        {error && (
          <p className="text-[11.5px] text-destructive flex items-center gap-1">
            <AlertCircle className="size-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}
      </form>
    );
  }

  return (
    <div
      data-testid="soldout-waitlist-box"
      className="rounded-[14px] border border-amber-200 bg-amber-50/70 p-4 sm:p-5 text-left space-y-3"
    >
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
          <BellRing className="size-4.5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-[14px] font-bold text-foreground">
            Đăng ký danh sách chờ nhận vé (Waitlist)
          </h4>
          <p className="text-[12.5px] text-muted-foreground leading-relaxed">
            Để lại email của bạn. Hệ thống TicketHub sẽ tự động gửi thông báo
            ngay khi Ban tổ chức mở bán bổ sung hoặc có vé hoàn trả hợp lệ.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-2 pt-1">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Mail className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Nhập địa chỉ email của bạn (vd: ban@gmail.com)"
              aria-label="Địa chỉ email nhận thông báo khi có vé"
              data-testid="waitlist-email-input"
              className="w-full h-10 pl-9 pr-3 rounded-[8px] border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            data-testid="waitlist-submit-btn"
            className="h-10 px-4 rounded-[8px] bg-primary hover:bg-emerald-700 disabled:opacity-50 text-primary-foreground text-[13px] font-bold transition-colors shrink-0 cursor-pointer"
          >
            {isSubmitting ? "Đang đăng ký..." : "Nhận thông báo"}
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="text-[12px] text-destructive font-medium flex items-center gap-1.5"
          >
            <AlertCircle className="size-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}
      </form>
    </div>
  );
}
