"use client";

import { useState, useRef, useCallback } from "react";
import { Plus, Minus, Maximize2 } from "lucide-react";
import { VENUE_SVG, type VenueMapKey } from "@/lib/venue-svg.generated";
import { formatVnd } from "@/lib/events-catalog";

interface SeatMapProps {
  mapKey: VenueMapKey;
  activeZoneId?: string | null;
  hoveredZoneId?: string | null;
  zoneInfoMap?: Record<string, { name: string; minPrice: number; count: number }>;
  onSelectZone: (zoneId: string | null) => void;
  onHoverZone: (zoneId: string | null) => void;
}

export function SeatMap(props: SeatMapProps) {
  return <SeatMapView key={props.mapKey} {...props} />;
}

function SeatMapView({
  mapKey,
  activeZoneId,
  hoveredZoneId,
  zoneInfoMap = {},
  onSelectZone,
  onHoverZone,
}: SeatMapProps) {
  const mapData = VENUE_SVG[mapKey] || VENUE_SVG["arena-t-stage"];

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{
    price: number;
    x: number;
    y: number;
  } | null>(null);

  const handleZoomIn = () => setZoom((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.75, Number((z - 0.25).toFixed(2))));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    onSelectZone(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        setPan({
          x: panStartRef.current.x + dx,
          y: panStartRef.current.y + dy,
        });
        return;
      }

      // Check hovering zone: only available zones show tooltip and highlight
      const target = (e.target as Element).closest("[data-zone]");
      if (target) {
        const zid = target.getAttribute("data-zone");
        if (zid && zoneInfoMap[zid]) {
          onHoverZone(zid);
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            setTooltip({
              price: zoneInfoMap[zid].minPrice,
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            });
          }
          return;
        }
      }
      onHoverZone(null);
      setTooltip(null);
    },
    [isDragging, onHoverZone, zoneInfoMap]
  );

  const handleMouseUp = () => setIsDragging(false);

  const handleClick = (e: React.MouseEvent) => {
    // Only process click if user wasn't dragging
    const dx = Math.abs(e.clientX - dragStartRef.current.x);
    const dy = Math.abs(e.clientY - dragStartRef.current.y);
    if (dx > 5 || dy > 5) return;

    const target = (e.target as Element).closest("[data-zone]");
    if (target) {
      const zid = target.getAttribute("data-zone");
      // Only available zones with active tickets can be clicked/selected
      if (zid && zoneInfoMap[zid]) {
        onSelectZone(activeZoneId === zid ? null : zid);
        return;
      }
    }
    // Clicked on empty space, non-selling zone, or sold-out zone: clear selection
    onSelectZone(null);
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        setIsDragging(false);
        onHoverZone(null);
        setTooltip(null);
      }}
      onClick={handleClick}
      role="region"
      aria-label="Sơ đồ khán đài tương tác"
      className="relative w-full h-full bg-[#f8fafc] overflow-hidden select-none cursor-grab active:cursor-grabbing"
    >
      {/* Floating Zoom & Reset Toolbar (top-right controls) */}
      <div className="absolute top-4 right-4 z-20 flex flex-col rounded-[8px] bg-white border border-[#dfe3e5] shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleZoomIn();
          }}
          aria-label="Phóng to"
          className="size-9 flex items-center justify-center text-[#141d23] hover:bg-[#f5f7f8] transition-colors border-b border-[#dfe3e5]"
        >
          <Plus className="size-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleZoomOut();
          }}
          aria-label="Thu nhỏ"
          className="size-9 flex items-center justify-center text-[#141d23] hover:bg-[#f5f7f8] transition-colors border-b border-[#dfe3e5]"
        >
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleReset();
          }}
          aria-label="Căn giữa toàn cảnh"
          className="size-9 flex items-center justify-center text-[#141d23] hover:bg-[#f5f7f8] transition-colors"
        >
          <Maximize2 className="size-3.5" />
        </button>
      </div>

      {/* Floating Hover Tooltip: Positioned directly above cursor and aligned center */}
      {tooltip && (
        <div
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y - 10}px`,
            pointerEvents: "none",
          }}
          className="absolute z-30 transform -translate-x-1/2 -translate-y-full bg-[#141d23] text-white text-[12px] px-2.5 py-1 rounded-[6px] shadow-lg whitespace-nowrap pointer-events-none select-none"
        >
          <span className="font-bold text-[#a7f3d0]">{formatVnd(tooltip.price)}</span>
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[#141d23]" />
        </div>
      )}

      {/* SVG Canvas with Pan & Zoom */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "center center",
          transition: isDragging ? "none" : "transform 0.15s ease-out",
        }}
        className="w-full h-full flex items-center justify-center p-4"
      >
        <svg
          viewBox={mapData.viewBox}
          className="w-full h-full max-h-[82vh] transition-colors duration-150"
          dangerouslySetInnerHTML={{ __html: mapData.markup }}
        />
      </div>

      {/* Dynamic CSS injecting live highlight styles based on activeZoneId and hoveredZoneId */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        /* Base section styles */
        .sec {
          fill: #eff6ff;
          stroke: #93c5fd;
          stroke-width: 3px;
          transition: all 0.2s ease;
          cursor: pointer;
        }

        /* Non-selling & Priority zones (simply gray and not clickable) */
        g[data-zone="11448"],
        g[data-zone="885"] {
          cursor: not-allowed !important;
        }
        g[data-zone="11448"] .sec,
        g[data-zone="885"] .sec {
          fill: #e2e8f0 !important;
          stroke: #cbd5e1 !important;
          stroke-dasharray: none !important;
          cursor: not-allowed !important;
        }
        g[data-zone="11448"] text,
        g[data-zone="885"] text {
          fill: #94a3b8 !important;
          font-weight: 500 !important;
        }

        /* Default for sections without active tickets (sold out or unlisted) */
        g[data-zone] {
          cursor: default;
        }
        g[data-zone] .sec {
          fill: #f8fafc;
          stroke: #cbd5e1;
          stroke-width: 2px;
          cursor: default;
          transition: all 0.15s ease;
        }
        g[data-zone] text {
          fill: #94a3b8;
          font-family: var(--font-sans), system-ui, sans-serif;
          font-weight: 600;
          pointer-events: none;
          user-select: none;
          transition: all 0.15s ease;
        }

        /* Available zones with active tickets */
        ${Object.keys(zoneInfoMap)
          .map(
            (zid) => `
        g[data-zone="${zid}"] .sec {
          fill: #ecfdf5;
          stroke: #10b981;
          stroke-width: 3px;
          cursor: pointer;
        }
        g[data-zone="${zid}"] text {
          fill: #064e3b;
          font-weight: 800;
        }
        `
          )
          .join("\n")}

        /* Hovered zone highlight */
        ${
          hoveredZoneId
            ? `
          g[data-zone="${hoveredZoneId}"] .sec {
            fill: #10b981 !important;
            stroke: #047857 !important;
            stroke-width: 6px !important;
            filter: drop-shadow(0 2px 8px rgba(16, 185, 129, 0.45));
          }
          g[data-zone="${hoveredZoneId}"] text {
            fill: #ffffff !important;
            font-weight: 800 !important;
          }
        `
            : ""
        }

        /* Active / Selected zone highlight */
        ${
          activeZoneId
            ? `
          g[data-zone]:not([data-zone="${activeZoneId}"]) {
            opacity: 0.35;
          }
          g[data-zone="${activeZoneId}"] .sec {
            fill: #059669 !important;
            stroke: #064e3b !important;
            stroke-width: 7px !important;
            filter: drop-shadow(0 4px 12px rgba(5, 150, 105, 0.55));
          }
          g[data-zone="${activeZoneId}"] text {
            fill: #ffffff !important;
            font-weight: 800 !important;
          }
        `
            : ""
        }

        /* Stage styling */
        .stage {
          fill: #334155 !important;
        }
        .stage-label {
          fill: #ffffff !important;
          font-weight: 800 !important;
          letter-spacing: 0.08em;
        }
        .prop {
          fill: #cbd5e1 !important;
        }
        .prop-box {
          stroke: #94a3b8 !important;
        }

        /* Football pitch styling */
        .pitch-apron {
          fill: #e2e8f0;
          stroke: #cbd5e1;
        }
        .pitch {
          fill: #4ade80 !important;
          stroke: #22c55e !important;
        }
        .pitch-mark {
          stroke: #ffffff !important;
          fill: none !important;
        }
      `,
        }}
      />
    </div>
  );
}
