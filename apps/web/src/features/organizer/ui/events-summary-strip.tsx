"use client";

import {
  ChevronRight,
  AlertCircle,
  Calendar,
  Ticket,
  DollarSign,
} from "lucide-react";
import {
  formatVndCurrency as formatVnd,
  formatNumberVi,
} from "@/shared/lib/format-vi";
import type { OrganizerEventsScreen } from "./use-organizer-events-screen";

/** Khoi giao dien: summary-strip. */
export function EventsSummaryStrip({ vm }: { vm: OrganizerEventsScreen }) {
  const { selectedStatus, selectedSort, metrics, handleSummaryStripClick } = vm;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Vé đã bán */}
        <button
          type="button"
          onClick={() => handleSummaryStripClick("SOLD")}
          className={`p-2.5 sm:p-3 rounded-lg border text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            selectedStatus === "PUBLISHED" && selectedSort !== "revenue_desc"
              ? "border-primary bg-accent/40"
              : "border-border bg-background hover:bg-secondary/40"
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Vé đã bán</span>
            <div className="flex items-center gap-1">
              <Ticket className="size-3.5 text-muted-foreground" />
              <ChevronRight className="size-3 text-muted-foreground/60" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-bold tracking-tight text-foreground mt-1 tabular-nums truncate">
            {formatNumberVi(metrics.totalSold)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            Tỷ lệ lấp đầy 84%
          </p>
        </button>

        {/* Doanh thu */}
        <button
          type="button"
          onClick={() => handleSummaryStripClick("REVENUE")}
          className={`p-2.5 sm:p-3 rounded-lg border text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            selectedSort === "revenue_desc"
              ? "border-primary bg-accent/40"
              : "border-border bg-background hover:bg-secondary/40"
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Doanh thu</span>
            <div className="flex items-center gap-1">
              <DollarSign className="size-3.5 text-muted-foreground" />
              <ChevronRight className="size-3 text-muted-foreground/60" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-bold tracking-tight text-foreground mt-1 tabular-nums whitespace-nowrap truncate">
            {formatVnd(metrics.totalRevenue)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            +12% so với tháng trước
          </p>
        </button>

        {/* Sắp diễn ra */}
        <button
          type="button"
          onClick={() => handleSummaryStripClick("UPCOMING")}
          className={`p-2.5 sm:p-3 rounded-lg border text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            selectedStatus === "PUBLISHED" && selectedSort === "date_asc"
              ? "border-primary bg-accent/40"
              : "border-border bg-background hover:bg-secondary/40"
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Sắp diễn ra</span>
            <div className="flex items-center gap-1">
              <Calendar className="size-3.5 text-muted-foreground" />
              <ChevronRight className="size-3 text-muted-foreground/60" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-bold tracking-tight text-foreground mt-1 tabular-nums truncate">
            {metrics.upcomingCount} sự kiện
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            Trong 30 ngày tới
          </p>
        </button>

        {/* Cần xử lý */}
        <button
          type="button"
          onClick={() => handleSummaryStripClick("ACTION")}
          className={`p-2.5 sm:p-3 rounded-lg border text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            selectedStatus === "ACTION_REQUIRED"
              ? "border-primary bg-accent/40"
              : "border-border bg-background hover:bg-secondary/40"
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Cần xử lý</span>
            <div className="flex items-center gap-1">
              <AlertCircle className="size-3.5 text-muted-foreground" />
              <ChevronRight className="size-3 text-muted-foreground/60" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-bold tracking-tight text-foreground mt-1 tabular-nums truncate">
            {metrics.actionRequiredCount} sự kiện
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            Bản nháp &amp; chờ duyệt
          </p>
        </button>
      </div>
    </>
  );
}
