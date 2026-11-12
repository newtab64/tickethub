"use client";

import Link from "next/link";
import Image from "next/image";
import { Clock, Share2, Info, ChevronDown } from "lucide-react";
import { formatTimer } from "../domain/checkout-rules";
import type { CheckoutScreen } from "./use-checkout-screen";

/** Thanh tieu de co dinh: dong ho giu cho MM:SS va huy giao dich. */
export function CheckoutHeader({ vm }: { vm: CheckoutScreen }) {
  const {
    order,
    secondsLeft,
    setShowCancelModal,
    setShowInfoModal,
    eventData,
  } = vm;

  return (
    <header className="sticky top-0 z-40 w-full bg-background border-b border-border shadow-xs">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-4">
        {/* Left: Seat View Thumbnail, Event Details, Status Chip */}
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1">
          <div className="relative w-14 h-14 sm:w-20 sm:h-20 rounded-lg sm:rounded-xl overflow-hidden shrink-0 border border-border bg-muted">
            <Image
              src="/assets/seat-view.jpg"
              alt="Góc nhìn từ chỗ ngồi"
              fill
              sizes="(max-width: 640px) 56px, 80px"
              className="object-cover"
              priority
            />
          </div>

          <div className="min-w-0 space-y-0.5 sm:space-y-1">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <Link
                href={order.eventId ? `/events/${order.eventId}` : "/events"}
                className="text-primary font-bold text-sm sm:text-base md:text-lg leading-tight truncate hover:underline"
              >
                {order.eventTitle || eventData.title}
              </Link>
              <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-destructive/10 text-destructive border border-destructive/20 shrink-0">
                Sắp hết vé
              </span>
            </div>

            <div className="text-[11px] sm:text-xs text-muted-foreground flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="shrink-0">
                {order.eventDateTime || eventData.fullDateTime}
              </span>
              <span className="hidden xs:inline">•</span>
              <span className="text-foreground underline underline-offset-2 decoration-muted-foreground/60 truncate">
                {order.eventVenue || eventData.venue}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Share, Countdown Timer with Clock & Info, Currency Selector */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Circular Share Button */}
          <button
            type="button"
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: order.eventTitle || eventData.title,
                  url: window.location.href,
                });
              } else {
                navigator.clipboard.writeText(window.location.href);
                alert("Đã sao chép liên kết đặt vé vào bộ nhớ tạm.");
              }
            }}
            aria-label="Chia sẻ sự kiện"
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-full border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors shrink-0"
          >
            <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>

          {/* Countdown Hold Capsule with Clock and Info Icons */}
          <div
            className={`inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border text-xs sm:text-sm font-semibold transition-colors shrink-0 ${
              secondsLeft <= 60
                ? "bg-destructive/10 border-destructive/30 text-destructive animate-pulse"
                : "bg-muted/70 border-border text-foreground"
            }`}
          >
            <Clock
              className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${secondsLeft <= 60 ? "text-destructive" : "text-muted-foreground"}`}
            />
            <span className="font-mono text-xs sm:text-sm font-bold tabular-nums">
              {formatTimer(secondsLeft)}
            </span>
            <button
              type="button"
              onClick={() => setShowInfoModal(true)}
              aria-label="Thông tin thời hạn giữ vé"
              className="text-muted-foreground hover:text-foreground"
            >
              <Info className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </button>
          </div>

          {/* Currency / Language Selector */}
          <div className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border text-xs font-semibold text-foreground bg-background">
            <span>VND | VN</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </div>

          {/* Abort reservation link */}
          <button
            type="button"
            onClick={() => setShowCancelModal(true)}
            className="text-xs font-medium text-muted-foreground hover:text-destructive hidden lg:inline ml-1"
          >
            Hủy
          </button>
        </div>
      </div>
    </header>
  );
}
