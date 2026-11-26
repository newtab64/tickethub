"use client";

import { X } from "lucide-react";
import { SeatMap } from "@/features/event";
import type { BookingScreen } from "./use-booking-screen";

/** Khung ben trai: so do khu vuc SVG tuong tac. */
export function BookingMapPane({ vm }: { vm: BookingScreen }) {
  const {
    mapKey,
    activeZoneId,
    setActiveZoneId,
    hoveredZoneId,
    setHoveredZoneId,
    zoneInfoMap,
  } = vm;

  return (
    <div className="w-full lg:w-[58%] xl:w-[62%] h-[42vh] lg:h-full relative border-b lg:border-b-0 lg:border-r border-[#dfe3e5] bg-[#f8fafc] flex flex-col">
      {/* Active section filter badge if selected */}
      {activeZoneId && (
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-white px-3 py-1.5 rounded-[8px] border border-[#dfe3e5] shadow-xs text-[12px]">
          <span className="text-[#606970]">Đang lọc:</span>
          <strong className="text-primary font-bold">
            {zoneInfoMap[activeZoneId]?.name || `Khu ${activeZoneId}`}
          </strong>
          <button
            type="button"
            onClick={() => setActiveZoneId(null)}
            aria-label="Xóa bộ lọc khu vực"
            className="size-5 rounded-full hover:bg-[#eff1f2] flex items-center justify-center text-[#606970]"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* SeatMap Canvas */}
      <div className="flex-1 w-full h-full">
        <SeatMap
          mapKey={mapKey}
          activeZoneId={activeZoneId}
          hoveredZoneId={hoveredZoneId}
          zoneInfoMap={zoneInfoMap}
          onSelectZone={(zid) => setActiveZoneId(zid)}
          onHoverZone={(zid) => setHoveredZoneId(zid)}
        />
      </div>
    </div>
  );
}
