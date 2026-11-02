// apps/web/src/components/ui/date-range-popover.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar as CalendarIcon, X, ChevronDown } from "lucide-react";
import { DatePicker } from "./date-picker";
import { formatDateVi } from "@/lib/organizer-service";

interface DateRangePopoverProps {
  fromDate: string;
  toDate: string;
  onChange: (fromDate: string, toDate: string) => void;
  className?: string;
}

export function DateRangePopover({
  fromDate,
  toDate,
  onChange,
  className = "",
}: DateRangePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState(fromDate);
  const [tempTo, setTempTo] = useState(toDate);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasValue = Boolean(fromDate || toDate);

  const label = hasValue
    ? fromDate && toDate
      ? `${formatDateVi(fromDate)} - ${formatDateVi(toDate)}`
      : fromDate
        ? `Từ ${formatDateVi(fromDate)}`
        : `Đến ${formatDateVi(toDate)}`
    : "Khoảng ngày";

  const handleApply = () => {
    onChange(tempFrom, tempTo);
    setIsOpen(false);
  };

  const handleClear = () => {
    setTempFrom("");
    setTempTo("");
    onChange("", "");
    setIsOpen(false);
  };

  // Quick preset helper
  const handlePreset = (daysAhead: number) => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + daysAhead);

    const fStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    const tStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;

    setTempFrom(fStr);
    setTempTo(tStr);
    onChange(fStr, tStr);
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="Lọc theo khoảng ngày"
        onClick={() => {
          setIsOpen((prev) => {
            if (!prev) {
              setTempFrom(fromDate);
              setTempTo(toDate);
            }
            return !prev;
          });
        }}
        className={`w-full h-10 px-3 rounded-md border text-sm text-left flex items-center justify-between gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          hasValue
            ? "border-primary bg-accent/30 text-foreground font-medium"
            : "border-input bg-background text-foreground hover:bg-secondary/40"
        } ${isOpen ? "ring-2 ring-ring" : ""}`}
      >
        <div className="flex items-center gap-2 truncate">
          <CalendarIcon className="size-4 text-muted-foreground shrink-0" />
          <span className="truncate text-xs sm:text-sm tabular-nums">
            {label}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {hasValue && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Xóa khoảng ngày"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  handleClear();
                }
              }}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
            >
              <X className="size-3.5" />
            </span>
          )}
          <ChevronDown
            className={`size-3.5 text-muted-foreground transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Hộp thoại chọn khoảng ngày"
          className="absolute right-0 mt-1.5 w-80 rounded-lg border border-border bg-popover text-popover-foreground shadow-xl p-4 z-50 text-xs space-y-4 focus:outline-none"
        >
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="font-bold text-foreground">Chọn khoảng ngày</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handlePreset(7)}
                className="px-2 py-0.5 rounded bg-secondary hover:bg-secondary/80 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                7 ngày
              </button>
              <button
                type="button"
                onClick={() => handlePreset(30)}
                className="px-2 py-0.5 rounded bg-secondary hover:bg-secondary/80 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                30 ngày
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">
                Từ ngày (dd/mm/yyyy)
              </label>
              <DatePicker
                value={tempFrom}
                onChange={(val) => setTempFrom(val)}
                placeholder="dd/mm/yyyy"
                ariaLabel="Từ ngày"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">
                Đến ngày (dd/mm/yyyy)
              </label>
              <DatePicker
                value={tempTo}
                minDate={tempFrom}
                onChange={(val) => setTempTo(val)}
                placeholder="dd/mm/yyyy"
                ariaLabel="Đến ngày"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <button
              type="button"
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground text-xs font-medium cursor-pointer"
            >
              Xóa bộ lọc
            </button>

            <button
              type="button"
              onClick={handleApply}
              className="h-8 px-3 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
