"use client";

import { Flame } from "lucide-react";

/** Dai nhac nho do khan. */
export function BookingUrgencyStrip() {
  return (
    <div className="h-[32px] bg-[#fdf2f4] border-b border-[#fee2e2] px-4 sm:px-6 flex items-center justify-center text-center gap-2 text-[12px] text-[#991b1b] font-medium shrink-0">
      <Flame className="size-3.5 text-[#e11d48] shrink-0" />
      <span>Sắp hết vé! Hơn 70 người đang xem sự kiện này trong 1 giờ qua</span>
    </div>
  );
}
