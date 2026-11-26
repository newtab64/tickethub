"use client";

import { X } from "lucide-react";
import type { BookingScreen } from "./use-booking-screen";

/** Hop thoai "Ban can bao nhieu ve?" (1 den 6 ve). */
export function QuantityModal({ vm }: { vm: BookingScreen }) {
  const { ticketQuantity, setTicketQuantity, setShowQtyModal } = vm;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-[360px] bg-background rounded-[20px] shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150 relative">
        {/* Close button */}
        <button
          type="button"
          onClick={() => setShowQtyModal(false)}
          className="absolute top-4 right-4 p-1.5 rounded-full text-[#606970] hover:text-[#141d23] hover:bg-[#f5f7f8] transition-colors"
        >
          <X className="size-5" />
        </button>

        <div className="text-center space-y-1 pt-1">
          <h2 className="text-[20px] font-extrabold text-[#141d23]">
            Bạn cần bao nhiêu vé?
          </h2>
          <p className="text-[13px] text-[#606970]">
            Các ghế ngồi sẽ được xếp cạnh nhau
          </p>
        </div>

        {/* Ticket Quantity Grid: 1 to 6 (UC04 limit) */}
        <div className="grid grid-cols-3 gap-3 pt-1">
          {[1, 2, 3, 4, 5, 6].map((qty) => {
            const isSelected = ticketQuantity === qty;
            return (
              <button
                key={qty}
                type="button"
                onClick={() => setTicketQuantity(qty)}
                className={`h-14 rounded-[12px] border text-[20px] font-extrabold transition-all flex items-center justify-center ${
                  isSelected
                    ? "border-primary bg-primary text-white shadow-xs"
                    : "border-[#dfe3e5] bg-white text-[#141d23] hover:border-primary hover:bg-[#f8fafc]"
                }`}
              >
                {qty}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setShowQtyModal(false)}
          className="w-full h-11 rounded-[10px] bg-primary hover:bg-emerald-700 text-white font-bold text-[14px] transition-colors shadow-xs"
        >
          Tiếp tục
        </button>
      </div>
    </div>
  );
}
