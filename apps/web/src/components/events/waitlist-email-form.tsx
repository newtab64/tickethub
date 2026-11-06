// apps/web/src/components/events/waitlist-email-form.tsx
"use client";

import { useState } from "react";
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
      setError("Vui lòng nhập email của bạn.");
      return;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      setError("Email chưa đúng định dạng.");
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
        className="rounded-[10px] bg-muted border border-border px-4 py-3 text-[13px] text-foreground"
      >
        Đã ghi nhận email. Chúng tôi sẽ gửi thông báo cho bạn ngay khi{" "}
        <strong>{eventTitle || "sự kiện"}</strong> có vé trở lại.
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
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Email của bạn..."
            aria-label="Email nhận thông báo sự kiện"
            data-testid="waitlist-email-input"
            className="h-10 px-3.5 rounded-[8px] border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground min-w-[240px]"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            data-testid="waitlist-submit-btn"
            className="h-10 rounded-[8px] bg-foreground hover:opacity-90 disabled:opacity-50 px-4 text-[13px] font-semibold text-background transition-opacity shrink-0 cursor-pointer"
          >
            {isSubmitting ? "Đang gửi..." : "Nhận thông báo"}
          </button>
        </div>
        {error && <p className="text-[12px] text-destructive">{error}</p>}
      </form>
    );
  }

  return (
    <div data-testid="soldout-waitlist-box" className="text-left space-y-3">
      <form onSubmit={handleSubmit} noValidate className="space-y-2.5">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Nhập email của bạn (vd: ten@gmail.com)"
          aria-label="Địa chỉ email nhận thông báo khi có vé"
          data-testid="waitlist-email-input"
          className="w-full h-11 px-3.5 rounded-[10px] border border-border bg-background text-[13.5px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />

        {error && (
          <p role="alert" className="text-[12px] text-destructive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          data-testid="waitlist-submit-btn"
          className="w-full h-11 rounded-[10px] bg-primary hover:bg-emerald-700 disabled:opacity-50 text-primary-foreground text-[14px] font-bold transition-colors cursor-pointer"
        >
          {isSubmitting ? "Đang đăng ký..." : "Báo cho tôi khi có vé"}
        </button>
      </form>
    </div>
  );
}
