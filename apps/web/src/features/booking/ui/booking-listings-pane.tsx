"use client";

import {
  Flame,
  SlidersHorizontal,
  ChevronDown,
  X,
  Users,
  AlertCircle,
} from "lucide-react";
import { availabilityLabel } from "@/features/event";
import { formatVnd } from "@/shared/lib/format";
import { listingBlockReason } from "../domain/booking-rules";
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
    <div
      className={`w-full flex flex-col bg-white overflow-hidden ${
        vm.mapKey ? "lg:w-[42%] xl:w-[38%] h-[58vh] lg:h-full" : "h-full"
      }`}
    >
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
            // Hang ve khong gan khu co zoneId rong, khong duoc coi la cung mot khu.
            const isHovered =
              listing.zoneId !== "" && hoveredZoneId === listing.zoneId;
            const isSelected = selectedListing?.id === listing.id;
            const blocked = listingBlockReason(listing, ticketQuantity);
            const isAvailable = blocked === null;

            return (
              <div
                key={listing.id}
                onMouseEnter={() => setHoveredZoneId(listing.zoneId)}
                onMouseLeave={() => setHoveredZoneId(null)}
                onClick={() => {
                  if (blocked) {
                    setHoldErrorMessage(blocked);
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
                {/* Middle: Clean details with small metadata icons */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[14px] sm:text-[15px] font-bold text-foreground leading-snug">
                      {listing.zoneName}
                    </h2>
                    {!isAvailable && (
                      <span className="px-2 py-0.5 rounded-[4px] bg-destructive/10 text-destructive text-[10.5px] font-bold">
                        {!listing.onSale
                          ? "Ngoài giờ bán"
                          : listing.availableTickets <= 0
                            ? "Hết vé"
                            : `Còn ${listing.availableTickets} vé`}
                      </span>
                    )}
                  </div>

                  <div className="space-y-0.5 pt-0.5 text-[11.5px] text-[#606970]">
                    <div className="flex items-center gap-1.5">
                      <Users className="size-3.5 text-[#606970] shrink-0" />
                      <span>
                        {listing.isStanding
                          ? `${ticketQuantity} vé đứng tự do`
                          : `${ticketQuantity} vé ngồi cạnh nhau`}
                      </span>
                    </div>

                    {isAvailable &&
                      availabilityLabel(listing.availableTickets) ===
                        "Sắp hết" && (
                        <div className="pt-0.5">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-[#fef2f2] text-[#dc2626] border border-[#fecaca] text-[10.5px] font-bold">
                            <Flame className="size-3 text-[#dc2626]" />
                            Sắp hết vé
                          </span>
                        </div>
                      )}
                  </div>
                </div>

                {/* Right: Price */}
                <div className="text-right shrink-0 flex flex-col items-end">
                  <div className="text-[16px] sm:text-[17px] font-extrabold text-foreground leading-tight">
                    {formatVnd(listing.price)}
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
