// apps/web/src/components/ui/date-picker.tsx
"use client";

import { useState, useRef, useEffect, useMemo, useId } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  X,
} from "lucide-react";

// ==========================================
// 1. Single Date Picker (dd/mm/yyyy with Popover Calendar)
// ==========================================

interface DatePickerProps {
  value: string; // ISO date 'YYYY-MM-DD'
  onChange: (value: string) => void;
  minDate?: string; // 'YYYY-MM-DD'
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

const VI_WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export function DatePicker({
  value,
  onChange,
  minDate,
  placeholder = "dd/mm/yyyy",
  ariaLabel,
  className = "",
  disabled = false,
  id: customId,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoId = useId();
  const id = customId || autoId;

  // User navigation override for month & year
  const [navMonthDate, setNavMonthDate] = useState<Date | null>(null);

  // Derived active view date
  const viewDate = useMemo(() => {
    if (navMonthDate) return navMonthDate;
    if (value) {
      const parts = value.split("-").map(Number);
      if (parts[0] && parts[1] && parts[2]) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
      }
    }
    return new Date();
  }, [navMonthDate, value]);

  // Close calendar popover on outside click
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

  // Format display as dd/mm/yyyy
  const displayValue = useMemo(() => {
    if (!value) return "";
    const parts = value.split("-");
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return value;
  }, [value]);

  // Compute days in current view month
  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Monday is index 0 in Vietnam (0 = Monday, 6 = Sunday)
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const totalDays = lastDayOfMonth.getDate();
    const days: Array<{ day: number; dateString: string; isCurrentMonth: boolean }> = [];

    // Previous month filler days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const m = month === 0 ? 12 : month;
      const y = month === 0 ? year - 1 : year;
      days.push({
        day: d,
        dateString: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      days.push({
        day: d,
        dateString: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        isCurrentMonth: true,
      });
    }

    // Next month filler days to complete grid
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const m = month === 11 ? 1 : month + 2;
      const y = month === 11 ? year + 1 : year;
      days.push({
        day: d,
        dateString: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [viewDate]);

  const handlePrevMonth = () => {
    setNavMonthDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setNavMonthDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleSelectDay = (dateStr: string) => {
    onChange(dateStr);
    setNavMonthDate(null);
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block w-full ${className}`} ref={containerRef}>
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => {
          if (!disabled) setIsOpen((p) => !p);
        }}
        className={`w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground text-left flex items-center justify-between gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none hover:bg-secondary/40 ${
          isOpen ? "ring-2 ring-ring" : ""
        }`}
      >
        <span className="truncate tabular-nums">
          {displayValue || (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Xóa ngày"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onChange("");
                }
              }}
              className="hover:text-foreground p-0.5 rounded cursor-pointer"
            >
              <X className="size-3.5" />
            </span>
          )}
          <CalendarIcon className="size-4" aria-hidden="true" />
        </div>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Lịch chọn ngày"
          className="absolute left-0 mt-1.5 w-72 rounded-lg border border-border bg-popover text-popover-foreground shadow-xl p-3 z-50 text-xs focus:outline-none"
        >
          {/* Calendar Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
            <button
              type="button"
              aria-label="Tháng trước"
              onClick={handlePrevMonth}
              className="size-7 rounded-md border border-border bg-background hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              <ChevronLeft className="size-4" />
            </button>

            <span className="font-bold text-foreground">
              Tháng {viewDate.getMonth() + 1}, {viewDate.getFullYear()}
            </span>

            <button
              type="button"
              aria-label="Tháng sau"
              onClick={handleNextMonth}
              className="size-7 rounded-md border border-border bg-background hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center font-semibold text-[11px] text-muted-foreground pb-1.5">
            {VI_WEEKDAYS.map((wd) => (
              <span key={wd}>{wd}</span>
            ))}
          </div>

          {/* Day Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarDays.map((item, idx) => {
              const isSelected = item.dateString === value;
              const isDisabled = Boolean(minDate && item.dateString < minDate);

              return (
                <button
                  key={`${item.dateString}-${idx}`}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleSelectDay(item.dateString)}
                  className={`size-8 rounded-md text-xs tabular-nums flex items-center justify-center transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                      : item.isCurrentMonth
                      ? "text-foreground hover:bg-secondary"
                      : "text-muted-foreground/40 hover:bg-secondary/40"
                  } ${
                    isDisabled
                      ? "opacity-30 pointer-events-none cursor-not-allowed"
                      : ""
                  }`}
                >
                  {item.day}
                </button>
              );
            })}
          </div>

          {/* Bottom quick actions */}
          <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-border text-[11px]">
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                const str = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
                handleSelectDay(str);
              }}
              className="text-primary hover:underline font-semibold cursor-pointer"
            >
              Hôm nay
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 2. 24h Time Picker (15-min intervals, strictly 24h)
// ==========================================

interface TimePickerProps {
  value: string; // 'HH:mm'
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

// Generate 24h intervals in 15-minute steps
const TIME_OPTIONS_15MIN: string[] = [];
for (let h = 0; h < 24; h++) {
  const hh = String(h).padStart(2, "0");
  TIME_OPTIONS_15MIN.push(`${hh}:00`, `${hh}:15`, `${hh}:30`, `${hh}:45`);
}

export function TimePicker({
  value,
  onChange,
  placeholder = "HH:mm",
  ariaLabel,
  className = "",
  disabled = false,
  id: customId,
}: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const autoId = useId();
  const id = customId || autoId;

  // Close dropdown on outside click
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

  // Scroll to current selected time when opened
  useEffect(() => {
    if (isOpen && listRef.current && value) {
      const selectedEl = listRef.current.querySelector<HTMLElement>(
        `[data-time="${value}"]`
      );
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: "center" });
      }
    }
  }, [isOpen, value]);

  return (
    <div className={`relative inline-block w-full ${className}`} ref={containerRef}>
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => {
          if (!disabled) setIsOpen((p) => !p);
        }}
        className={`w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground text-left flex items-center justify-between gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none hover:bg-secondary/40 ${
          isOpen ? "ring-2 ring-ring" : ""
        }`}
      >
        <span className="truncate tabular-nums">
          {value || <span className="text-muted-foreground">{placeholder}</span>}
        </span>
        <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Xóa giờ"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onChange("");
                }
              }}
              className="hover:text-foreground p-0.5 rounded cursor-pointer"
            >
              <X className="size-3.5" />
            </span>
          )}
          <Clock className="size-4" aria-hidden="true" />
        </div>
      </button>

      {isOpen && (
        <div
          ref={listRef}
          role="listbox"
          aria-label="Chọn giờ theo định dạng 24h"
          className="absolute left-0 mt-1.5 w-full min-w-[120px] max-h-56 overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg py-1 z-50 text-xs focus:outline-none"
        >
          {TIME_OPTIONS_15MIN.map((time) => {
            const isSelected = time === value;

            return (
              <div
                key={time}
                role="option"
                data-time={time}
                aria-selected={isSelected}
                onClick={() => {
                  onChange(time);
                  setIsOpen(false);
                }}
                className={`px-3 py-1.5 cursor-pointer transition-colors tabular-nums flex items-center justify-between ${
                  isSelected
                    ? "bg-accent/40 font-semibold text-primary"
                    : "text-foreground hover:bg-secondary"
                }`}
              >
                <span>{time}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
