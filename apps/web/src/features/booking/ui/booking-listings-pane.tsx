"use client";

import Image from "next/image";
import {
  Flame,
  SlidersHorizontal,
  ChevronDown,
  X,
  Eye,
  Users,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { formatVnd } from "@/shared/lib/format";
import type { BookingScreen } from "./use-booking-screen";

/** Khung ben phai: bo loc va danh sach hang ve. */
export function BookingListingsPane({ vm }: { vm: BookingScreen }) {
  const {
    ticketQuantity,
    setShowQtyModal,
    activeZoneId,
    setActiveZoneId,
    hoveredZoneId,
    setHoveredZoneId,
    selectedListing,
    holdErrorMessage,
    setHoldErrorMessage,
    filteredListings,
    zoneInfoMap,
    handleStartHold,
  } = vm;

  return (
    <div className="w-full lg:w-[42%] xl:w-[38%] h-[58vh] lg:h-full flex flex-col bg-white overflow-hidden">
      {/* Top Filter Bar inside right pane */}
      <div className="px-4 py-3 border-b border-[#dfe3e5] bg-white flex items-center justify-between gap-3 shrink-0">
        <div className="text-[12.5px] text-[#606970] font-medium">
          {activeZoneId ? (
            <span>
              Đang xem:{" "}
              <strong className="text-[#141d23]">
                {zoneInfoMap[activeZoneId]?.name || `Khu ${activeZoneId}`}
              </strong>
            </span>
          ) : (
            <span>Tất cả các khu vực</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="size-9 rounded-[8px] border border-[#dfe3e5] hover:border-[#868f97] flex items-center justify-center text-[#141d23] transition-colors"
            aria-label="Bộ lọc tìm kiếm vé"
          >
            <SlidersHorizontal className="size-4" />
          </button>

          {/* Ticket Quantity Dropdown Button */}
          <button
            type="button"
            onClick={() => setShowQtyModal(true)}
            className="h-9 px-3.5 rounded-[8px] border border-[#dfe3e5] hover:border-primary hover:bg-emerald-50/40 text-[13px] font-bold text-[#141d23] flex items-center gap-2 transition-colors"
          >
            <Users className="size-4 text-primary" />
            <span>{ticketQuantity} vé</span>
            <ChevronDown className="size-3.5 text-[#606970]" />
          </button>
        </div>
      </div>

      {/* Error Message Banner */}
      {holdErrorMessage && (
        <div className="m-3 sm:m-4 p-3 rounded-[8px] bg-destructive/10 border border-destructive/30 text-destructive text-[12.5px] flex items-start justify-between gap-2.5 animate-in fade-in duration-150 shrink-0">
          <div className="flex items-start gap-2">
            <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-destructive">
                Không thể giữ chỗ
              </div>
              <div className="text-[12px] text-destructive leading-snug">
                {holdErrorMessage}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setHoldErrorMessage(null)}
            aria-label="Đóng thông báo lỗi"
            className="text-destructive/70 hover:text-destructive shrink-0 p-0.5"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Scrollable Ticket Listings */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#dfe3e5]">
        {filteredListings.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <h3 className="text-[15px] font-bold text-[#141d23]">
              Khu vực đã chọn hiện chưa có vé phù hợp
            </h3>
            <p className="text-[13px] text-[#606970] max-w-xs mx-auto">
              Khu vực này hiện đã bán hết hoặc không đủ số lượng vé bạn chọn.
              Quý khách vui lòng chọn các khu vực khác.
            </p>
            <button
              type="button"
              onClick={() => setActiveZoneId(null)}
              className="px-4 py-2 rounded-[8px] bg-primary text-white text-[13px] font-bold hover:bg-emerald-700 transition-colors"
            >
              Xem tất cả các khu vực
            </button>
          </div>
        ) : (
          filteredListings.map((listing) => {
            const isHovered = hoveredZoneId === listing.zoneId;
            const isSelected = selectedListing?.id === listing.id;
            const isAvailable = listing.availableTickets >= ticketQuantity;

            return (
              <div
                key={listing.id}
                onMouseEnter={() => setHoveredZoneId(listing.zoneId)}
                onMouseLeave={() => setHoveredZoneId(null)}
                onClick={() => {
                  if (!isAvailable) {
                    setHoldErrorMessage(
                      `Hạng vé ${listing.section} chỉ còn ${listing.availableTickets} vé, không đủ cho yêu cầu ${ticketQuantity} vé của bạn. Vui lòng giảm số lượng vé hoặc chọn hạng vé khác.`,
                    );
                    return;
                  }
                  handleStartHold(listing);
                }}
                className={`p-3.5 sm:p-4 transition-colors flex gap-3.5 sm:gap-4 items-start ${
                  !isAvailable
                    ? "bg-muted opacity-60 cursor-not-allowed border-l-4 border-l-border"
                    : isSelected
                      ? "bg-emerald-50/70 border-l-4 border-l-primary cursor-pointer"
                      : isHovered
                        ? "bg-muted cursor-pointer"
                        : "hover:bg-muted cursor-pointer"
                }`}
              >
                {/* Left: Clean Thumbnail Stage Photo */}
                <div className="w-[110px] sm:w-[124px] aspect-[16/10] rounded-[8px] overflow-hidden bg-[#eff1f2] shrink-0 border border-[#dfe3e5]">
                  <Image
                    src={listing.viewFromSeatUrl}
                    alt={listing.section}
                    width={124}
                    height={78}
                    unoptimized
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Middle: Clean details with small metadata icons */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[14px] sm:text-[15px] font-bold text-foreground leading-snug">
                      {listing.section}
                    </h2>
                    {!isAvailable && (
                      <span className="px-2 py-0.5 rounded-[4px] bg-destructive/10 text-destructive text-[10.5px] font-bold">
                        Chỉ còn {listing.availableTickets} vé
                      </span>
                    )}
                  </div>

                  {listing.row && (
                    <div className="text-[12px] text-[#606970]">
                      {listing.row}
                    </div>
                  )}

                  <div className="space-y-0.5 pt-0.5 text-[11.5px] text-[#606970]">
                    <div className="flex items-center gap-1.5">
                      <Users className="size-3.5 text-[#606970] shrink-0" />
                      <span>
                        {listing.isStanding
                          ? `${ticketQuantity} vé đứng tự do`
                          : `${ticketQuantity} vé ngồi cạnh nhau`}
                      </span>
                    </div>

                    {listing.section.toLowerCase().includes("vip") && (
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-amber-600 shrink-0" />
                        <span>Gói quyền lợi VIP &amp; Lối vào ưu tiên</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5">
                      <Eye className="size-3.5 text-[#606970] shrink-0" />
                      <span>Tầm nhìn trực diện</span>
                    </div>

                    {listing.isLastTickets && isAvailable && (
                      <div className="pt-0.5">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-[#fef2f2] text-[#dc2626] border border-[#fecaca] text-[10.5px] font-bold">
                          <Flame className="size-3 text-[#dc2626]" />
                          Sắp hết vé
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Price & Deal Score Badge */}
                <div className="text-right shrink-0 flex flex-col items-end">
                  <div className="text-[16px] sm:text-[17px] font-extrabold text-foreground leading-tight">
                    {formatVnd(listing.price)}
                  </div>
                  {!isAvailable && (
                    <div className="text-[11px] text-destructive font-semibold pt-0.5">
                      Không đủ {ticketQuantity} vé
                    </div>
                  )}
                  {listing.originalPrice &&
                    listing.originalPrice > listing.price && (
                      <div className="text-[11px] text-[#606970] line-through">
                        {formatVnd(listing.originalPrice)}
                      </div>
                    )}

                  {/* Clean Deal Score: solid green square + green text, unboxed */}
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="size-5 rounded-[4px] bg-[#059669] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                      {listing.dealScore}
                    </span>
                    <span className="text-[12px] font-bold text-[#059669]">
                      {listing.dealLabel}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
