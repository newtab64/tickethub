"use client";

import { X, CheckCircle2, ShieldCheck } from "lucide-react";
import { formatVnd } from "@/shared/lib/format";
import type { TicketListing } from "@/features/event";
import type { BookingScreen } from "./use-booking-screen";

/** Hop thoai xac nhan tam tinh truoc khi thanh toan. */
export function SubtotalModal({
  vm,
  selectedListing,
}: {
  vm: BookingScreen;
  selectedListing: TicketListing;
}) {
  const {
    event,
    router,
    ticketQuantity,
    setShowSubtotalModal,
    holdOrderId,
    holdTotalAmount,
  } = vm;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="subtotal-dialog-title"
      className="fixed inset-0 z-50 bg-foreground/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={() => setShowSubtotalModal(false)}
    >
      <div
        className="w-full max-w-[460px] bg-background rounded-[16px] shadow-2xl border border-border p-5 sm:p-6 space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border pb-3.5">
          <div>
            <h3
              id="subtotal-dialog-title"
              className="text-[17px] sm:text-[18px] font-extrabold text-foreground"
            >
              Xác nhận tạm tính đơn hàng
            </h3>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Vui lòng kiểm tra lại thông tin vé trước khi chuyển sang cổng
              thanh toán
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowSubtotalModal(false)}
            className="size-8 rounded-[8px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label="Đóng hộp thoại"
          >
            <X className="size-4.5" />
          </button>
        </div>

        {/* Event & Ticket Details */}
        <div className="rounded-[10px] bg-muted border border-border p-3.5 space-y-2.5 text-[13px]">
          <div className="font-bold text-foreground text-[14px] line-clamp-1">
            {event.title}
          </div>
          <div className="flex items-center justify-between text-muted-foreground text-[12.5px]">
            <span>Khu vực khán đài:</span>
            <span className="font-semibold text-foreground">
              {selectedListing.zoneName}
              {selectedListing.row ? ` • ${selectedListing.row}` : ""}
            </span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground text-[12.5px]">
            <span>Số lượng đặt:</span>
            <span className="font-semibold text-foreground">
              {ticketQuantity} vé
            </span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground text-[12.5px]">
            <span>Đơn giá mỗi vé:</span>
            <span className="font-semibold text-foreground">
              {formatVnd(selectedListing.price)}
            </span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground text-[12.5px]">
            <span>Phí dịch vụ &amp; nền tảng:</span>
            <span className="font-semibold text-emerald-600">
              Miễn phí (0đ)
            </span>
          </div>
          <div className="border-t border-border pt-2 flex items-center justify-between">
            <span className="font-extrabold text-foreground text-[14px]">
              Tạm tính tổng cộng:
            </span>
            <span className="text-[20px] font-black text-primary">
              {formatVnd(
                holdTotalAmount ?? selectedListing.price * ticketQuantity,
              )}
            </span>
          </div>
        </div>

        {/* Trust badge */}
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground bg-emerald-50/70 border border-emerald-100 rounded-[8px] p-2.5">
          <ShieldCheck className="size-4 text-primary shrink-0" />
          <span>
            Thanh toán an toàn qua cổng VNPay với cam kết 100% vé chính hãng.
          </span>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={() => {
              setShowSubtotalModal(false);
              if (holdOrderId) {
                router.push(`/checkout?orderId=${holdOrderId}`);
              }
            }}
            className="w-full h-11 rounded-[10px] bg-primary hover:bg-emerald-700 text-white text-[14px] font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <CheckCircle2 className="size-4.5" />
            Tiếp tục đến trang Thanh toán
          </button>
          <button
            type="button"
            onClick={() => setShowSubtotalModal(false)}
            className="w-full h-9 rounded-[8px] border border-border bg-background hover:bg-muted text-[12.5px] font-semibold text-muted-foreground transition-colors cursor-pointer"
          >
            Quay lại xem lại
          </button>
        </div>
      </div>
    </div>
  );
}
