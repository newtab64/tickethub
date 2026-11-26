"use client";

import Image from "next/image";
import Link from "next/link";
import { X, CheckCircle2, Timer, ShieldCheck } from "lucide-react";
import { formatVnd } from "@/shared/lib/format";
import type { TicketListing } from "@/features/event";
import type { BookingScreen } from "./use-booking-screen";

/** Ngan keo ve da chon va dong ho giu cho 5 phut. */
export function CheckoutDrawer({
  vm,
  selectedListing,
}: {
  vm: BookingScreen;
  selectedListing: TicketListing;
}) {
  const {
    isAdmin,
    cannotBuyTickets,
    router,
    ticketQuantity,
    setShowSubtotalModal,
    holdOrderId,
    holdTotalAmount,
    holdSecondsLeft,
    holdOrderCode,
    allocatedSeats,
    handleCancelHold,
    formatCountdown,
  } = vm;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg bg-white rounded-t-[20px] sm:rounded-[16px] shadow-2xl p-5 sm:p-6 space-y-5 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-[#dfe3e5] pb-3.5">
          <div>
            <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
              Xác nhận đặt vé
            </span>
            <h2 className="text-[18px] font-extrabold text-[#141d23]">
              {selectedListing.section}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleCancelHold}
            aria-label="Đóng cửa sổ đặt vé"
            className="size-8 rounded-full hover:bg-[#eff1f2] flex items-center justify-center text-[#606970]"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 5-Minute Hold Notice Banner */}
        {holdSecondsLeft !== null && holdSecondsLeft > 0 && (
          <div className="rounded-[10px] bg-emerald-50 border border-emerald-200 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary font-bold text-[13px]">
                <Timer className="size-4.5" />
                <span>Đang giữ chỗ • Mã {holdOrderCode}</span>
              </div>
              <span className="font-mono text-[16px] font-extrabold text-primary">
                {formatCountdown(holdSecondsLeft)}
              </span>
            </div>
            {allocatedSeats.length > 0 && (
              <div className="text-[12px] font-medium text-emerald-800 border-t border-emerald-200/60 pt-1.5 flex items-center justify-between">
                <span>Vị trí ghế đã cấp tự động:</span>
                <span className="font-mono font-bold">
                  Hàng {allocatedSeats[0]?.rowLabel} - Ghế{" "}
                  {allocatedSeats.map((s) => s.seatNumber).join(", ")}
                </span>
              </div>
            )}
          </div>
        )}

        {/* View From Seat preview */}
        <div className="rounded-[10px] overflow-hidden border border-[#dfe3e5] bg-[#141d23] aspect-[16/9] relative">
          <Image
            src={selectedListing.viewFromSeatUrl}
            alt="Góc nhìn thực tế từ chỗ ngồi"
            fill
            unoptimized
            className="object-cover"
          />
          <span className="absolute bottom-2 left-2 px-2 py-1 rounded-[6px] bg-black/75 text-white text-[11px] font-semibold">
            Góc nhìn thực tế sân khấu từ {selectedListing.section}
          </span>
        </div>

        {/* Seated Together Reassurance Note */}
        <div className="flex items-center gap-2 p-2.5 rounded-[8px] bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] font-semibold">
          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
          <span>
            {selectedListing.isStanding
              ? "Vé đứng tự do khu vực fanzone / sân khấu"
              : "Các ghế ngồi sẽ được xếp cạnh nhau"}
          </span>
        </div>

        {/* Ticket details summary */}
        <div className="bg-[#f8fafc] rounded-[10px] border border-[#dfe3e5] p-3.5 space-y-2 text-[13px]">
          <div className="flex items-center justify-between">
            <span className="text-[#606970]">Khu vực &amp; Vị trí:</span>
            <span className="font-bold text-[#141d23]">
              {selectedListing.zoneName}{" "}
              {selectedListing.row ? `• ${selectedListing.row}` : ""}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#606970]">Số lượng vé:</span>
            <span className="font-bold text-[#141d23]">
              {ticketQuantity} vé
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#606970]">Đơn giá:</span>
            <span className="font-semibold text-foreground">
              {formatVnd(selectedListing.price)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-[#dfe3e5] pt-2">
            <span className="font-bold text-[#141d23]">Tổng cộng:</span>
            <span className="text-[18px] font-extrabold text-primary">
              {formatVnd(
                holdTotalAmount ?? selectedListing.price * ticketQuantity,
              )}
            </span>
          </div>
        </div>

        {/* Buyer Protection Guarantee */}
        <div className="flex items-center gap-2 text-[12px] text-[#606970]">
          <ShieldCheck className="size-4 text-primary shrink-0" />
          <span>Cam kết vé chính thức 100% • Quét mã QR vào cổng</span>
        </div>

        {/* Action Buttons */}
        {cannotBuyTickets ? (
          <div className="rounded-[10px] bg-amber-50 border border-amber-200 p-3.5 space-y-2 mt-2">
            <div className="flex items-center gap-2 text-amber-800 font-bold text-[13px]">
              <ShieldCheck className="size-4.5 text-amber-600 shrink-0" />
              <span>
                {isAdmin
                  ? "Tài khoản Quản trị viên không thể mua vé sự kiện."
                  : "Tài khoản Ban tổ chức không thể mua vé sự kiện."}
              </span>
            </div>
            <p className="text-[12px] text-amber-700 leading-relaxed">
              {isAdmin
                ? "Nhằm ngăn ngừa xung đột lợi ích, tài khoản Admin không tham gia luồng thanh toán mua vé."
                : "Nhằm tuân thủ quy chuẩn chống găm vé nội bộ và gian lận thanh toán, vui lòng sử dụng tài khoản Người mua (Buyer) để đặt vé."}
            </p>
            <div className="space-y-1.5 pt-1">
              <Link
                href={isAdmin ? "/admin" : "/organizer/events"}
                className="inline-flex items-center justify-center w-full h-10 rounded-[8px] bg-amber-600 hover:bg-amber-700 text-white text-[13px] font-bold transition-colors"
              >
                {isAdmin ? "Về Cổng Quản trị" : "Về Quản lý sự kiện"}
              </Link>
              <button
                type="button"
                onClick={handleCancelHold}
                className="w-full h-8 rounded-[8px] border border-amber-200 bg-white hover:bg-amber-100/50 text-[12px] font-semibold text-amber-800 transition-colors cursor-pointer"
              >
                Hủy xem chỗ này
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={() => {
                if (holdOrderId) {
                  router.push(`/checkout?orderId=${holdOrderId}`);
                } else {
                  setShowSubtotalModal(true);
                }
              }}
              className="w-full h-11 rounded-[10px] bg-primary hover:bg-emerald-700 text-white text-[14px] font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="size-4.5" />
              Thanh toán qua VNPay &amp; Nhận vé QR
            </button>
            <button
              type="button"
              onClick={handleCancelHold}
              className="w-full h-9 rounded-[8px] border border-border bg-background hover:bg-muted text-[12px] font-semibold text-muted-foreground transition-colors cursor-pointer"
            >
              Hủy giữ chỗ &amp; chọn khu vực khác
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
