"use client";

import { Search, X } from "lucide-react";
import { formatDateVi } from "@/shared/lib/format-vi";
import { CustomSelect } from "@/shared/ui/custom-select";
import { DateRangePopover } from "@/shared/ui/date-range-popover";
import type { OrganizerEventsScreen } from "./use-organizer-events-screen";
import {
  STATUS_SELECT_OPTIONS,
  CITY_SELECT_OPTIONS,
  SORT_SELECT_OPTIONS,
} from "./organizer-events-content-helpers";

/** Khoi giao dien: toolbar. */
export function EventsToolbar({ vm }: { vm: OrganizerEventsScreen }) {
  const {
    searchInput,
    setSearchInput,
    selectedStatus,
    setSelectedStatus,
    selectedCity,
    setSelectedCity,
    selectedSort,
    setSelectedSort,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    setCurrentPage,
    updateUrlParams,
    filteredEvents,
    handleClearFilters,
    hasActiveFilters,
  } = vm;

  return (
    <>
      <div className="bg-background rounded-lg border border-border p-3 sm:p-3.5 space-y-3">
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2.5">
          {/* Search Input (flexible) */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm theo tên sự kiện, địa điểm, thành phố..."
              className="w-full h-10 pl-9 pr-8 rounded-md border border-input bg-background text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                aria-label="Xóa từ khóa tìm kiếm"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter (CustomSelect) */}
          <div className="w-[170px] shrink-0">
            <CustomSelect
              value={selectedStatus}
              onChange={(val) => {
                setSelectedStatus(val);
                setCurrentPage(1);
                updateUrlParams({ status: val, page: 1 });
              }}
              options={STATUS_SELECT_OPTIONS}
              ariaLabel="Lọc theo trạng thái"
            />
          </div>

          {/* City Filter (CustomSelect) */}
          <div className="w-[150px] shrink-0">
            <CustomSelect
              value={selectedCity}
              onChange={(val) => {
                setSelectedCity(val);
                setCurrentPage(1);
                updateUrlParams({ city: val, page: 1 });
              }}
              options={CITY_SELECT_OPTIONS}
              ariaLabel="Lọc theo thành phố"
            />
          </div>

          {/* Date Range Popover */}
          <div className="w-[165px] shrink-0">
            <DateRangePopover
              fromDate={fromDate}
              toDate={toDate}
              onChange={(f, t) => {
                setFromDate(f);
                setToDate(t);
                setCurrentPage(1);
                updateUrlParams({ from: f, to: t, page: 1 });
              }}
            />
          </div>

          {/* Sort Selection (CustomSelect) */}
          <div className="w-[185px] shrink-0">
            <CustomSelect
              value={selectedSort}
              onChange={(val) => {
                setSelectedSort(val);
                updateUrlParams({ sort: val });
              }}
              options={SORT_SELECT_OPTIONS}
              ariaLabel="Sắp xếp danh sách"
            />
          </div>
        </div>

        {/* Active Filter Chips & Matching Count */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border text-xs">
            <span className="text-xs font-semibold text-muted-foreground mr-1">
              {filteredEvents.length} sự kiện phù hợp:
            </span>

            {searchInput && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary text-foreground text-xs font-medium">
                Từ khóa: &quot;{searchInput}&quot;
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  aria-label="Xóa từ khóa"
                  className="hover:text-destructive cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </span>
            )}

            {selectedStatus !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary text-foreground text-xs font-medium">
                Trạng thái:{" "}
                {selectedStatus === "ACTION_REQUIRED"
                  ? "Cần xử lý"
                  : STATUS_SELECT_OPTIONS.find(
                      (s) => s.value === selectedStatus,
                    )?.label || selectedStatus}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStatus("ALL");
                    updateUrlParams({ status: null });
                  }}
                  aria-label="Xóa lọc trạng thái"
                  className="hover:text-destructive cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </span>
            )}

            {selectedCity !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary text-foreground text-xs font-medium">
                {selectedCity}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCity("ALL");
                    updateUrlParams({ city: null });
                  }}
                  aria-label="Xóa lọc thành phố"
                  className="hover:text-destructive cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </span>
            )}

            {(fromDate || toDate) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary text-foreground text-xs font-medium">
                {fromDate ? formatDateVi(fromDate) : "..."} -{" "}
                {toDate ? formatDateVi(toDate) : "..."}
                <button
                  type="button"
                  onClick={() => {
                    setFromDate("");
                    setToDate("");
                    updateUrlParams({ from: null, to: null });
                  }}
                  aria-label="Xóa lọc ngày"
                  className="hover:text-destructive cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs text-primary hover:underline font-semibold ml-1 cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          </div>
        )}
      </div>
    </>
  );
}
