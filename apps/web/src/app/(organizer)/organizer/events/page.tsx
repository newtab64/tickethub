"use client";

import { useState, useMemo, useEffect, useRef, Suspense, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Search,
  X,
  CheckCircle2,
  Clock,
  FileText,
  PauseCircle,
  XCircle,
  CheckCheck,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Calendar,
  Eye,
  Copy,
  Edit,
  Pause,
  Trash2,
  RefreshCw,
  Ticket,
  DollarSign,
  Layers,
} from "lucide-react";
import { EventStatus } from "@tickethub/shared";
import {
  MOCK_ORGANIZER_EVENTS,
  formatVnd,
  formatDateTimeVi,
  formatDateVi,
  formatNumberVi,
  getDisplayStatus,
  publishOrganizerEvent,
  pauseOrganizerEvent,
  cancelOrganizerEvent,
  cloneOrganizerEvent,
} from "@/lib/organizer-service";
import { CustomSelect, type SelectOption } from "@/components/ui/custom-select";
import { DateRangePopover } from "@/components/ui/date-range-popover";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";

// Status options for CustomSelect (derived strictly from contract and display states)
const STATUS_SELECT_OPTIONS: SelectOption[] = [
  { value: "ALL", label: "Tất cả trạng thái" },
  { value: "ACTION_REQUIRED", label: "Cần xử lý (Nháp / Chờ duyệt)" },
  { value: EventStatus.PUBLISHED, label: "Đang mở bán" },
  { value: EventStatus.DRAFT, label: "Bản nháp" },
  { value: EventStatus.PENDING_APPROVAL, label: "Chờ duyệt" },
  { value: EventStatus.SUSPENDED, label: "Tạm dừng" },
  { value: EventStatus.ENDED, label: "Đã kết thúc" },
  { value: EventStatus.CANCELLED, label: "Đã hủy" },
];

const CITY_SELECT_OPTIONS: SelectOption[] = [
  { value: "ALL", label: "Tất cả thành phố" },
  { value: "TP. Hồ Chí Minh", label: "TP. Hồ Chí Minh" },
  { value: "Hà Nội", label: "Hà Nội" },
  { value: "Đà Nẵng", label: "Đà Nẵng" },
];

// Shortened sort labels so nothing truncates at 1280px
const SORT_SELECT_OPTIONS: SelectOption[] = [
  { value: "date_asc", label: "Ngày diễn ra (gần nhất)" },
  { value: "date_desc", label: "Ngày diễn ra (xa nhất)" },
  { value: "revenue_desc", label: "Doanh thu (cao nhất)" },
  { value: "sold_desc", label: "Vé bán (nhiều nhất)" },
  { value: "title_asc", label: "Tên sự kiện (A - Z)" },
];

// Icon mapping helper for display statuses
function getStatusIcon(key: string) {
  switch (key) {
    case "SOLD_OUT":
      return CheckCheck;
    case "ALMOST_SOLD_OUT":
      return AlertCircle;
    case EventStatus.PUBLISHED:
      return CheckCircle2;
    case EventStatus.DRAFT:
      return FileText;
    case EventStatus.PENDING_APPROVAL:
      return Clock;
    case EventStatus.SUSPENDED:
      return PauseCircle;
    case EventStatus.ENDED:
      return CheckCheck;
    case EventStatus.CANCELLED:
      return XCircle;
    default:
      return Calendar;
  }
}

type PreviewState = "NORMAL" | "LOADING" | "EMPTY" | "ERROR";

function OrganizerEventsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL state synchronization
  const querySearch = searchParams.get("search") || "";
  const queryStatus = searchParams.get("status") || "ALL";
  const queryCity = searchParams.get("city") || "ALL";
  const querySort = searchParams.get("sort") || "date_asc";
  const queryFrom = searchParams.get("from") || "";
  const queryTo = searchParams.get("to") || "";
  const queryPage = parseInt(searchParams.get("page") || "1", 10);

  // Local filter states initialized from URL
  const [searchInput, setSearchInput] = useState(querySearch);
  const [selectedStatus, setSelectedStatus] = useState<string>(queryStatus);
  const [selectedCity, setSelectedCity] = useState<string>(queryCity);
  const [selectedSort, setSelectedSort] = useState<string>(querySort);
  const [fromDate, setFromDate] = useState<string>(queryFrom);
  const [toDate, setToDate] = useState<string>(queryTo);
  const [currentPage, setCurrentPage] = useState<number>(queryPage);

  // Dev preview switcher for state verification
  const queryPreview = searchParams.get("preview");
  const [previewState, setPreviewState] = useState<PreviewState>(
    queryPreview === "LOADING" || queryPreview === "EMPTY" || queryPreview === "ERROR"
      ? queryPreview
      : "NORMAL"
  );
  const isDev = process.env.NODE_ENV === "development" || Boolean(queryPreview);

  // Active row dropdown state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  // Sync state to URL params
  const updateUrlParams = useCallback(
    (updates: Record<string, string | number | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === "" || value === "ALL") {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      });
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  // Sync external search input after typing debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== querySearch) {
        setCurrentPage(1);
        updateUrlParams({ search: searchInput, page: 1 });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, querySearch, updateUrlParams]);

  // Click outside to close active dropdown menu
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(e.target as Node)
      ) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fixed now timestamp for pure render ordering
  const nowMs = useMemo(() => new Date().getTime(), []);

  // Compute Summary Strip Metrics
  // // TODO(contract): Replace with GET /api/v1/organizer/metrics
  const metrics = useMemo(() => {
    const all = MOCK_ORGANIZER_EVENTS;
    const totalSold = all.reduce((sum, e) => sum + e.ticketsSold, 0);
    const totalRevenue = all.reduce((sum, e) => sum + e.revenue, 0);
    const upcomingCount = all.filter(
      (e) =>
        e.status === EventStatus.PUBLISHED &&
        new Date(e.startTime).getTime() >= nowMs
    ).length;
    const actionRequiredCount = all.filter(
      (e) =>
        e.status === EventStatus.DRAFT ||
        e.status === EventStatus.PENDING_APPROVAL ||
        e.status === EventStatus.SUSPENDED
    ).length;

    return {
      totalSold,
      totalRevenue,
      upcomingCount,
      actionRequiredCount,
    };
  }, [nowMs]);

  // Filtered & Sorted Events
  // // TODO(contract): Replace with GET /api/v1/organizer/events query params
  const filteredEvents = useMemo(() => {
    if (previewState === "EMPTY") return [];

    let list = [...MOCK_ORGANIZER_EVENTS];

    // Search query
    if (searchInput.trim()) {
      const q = searchInput.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.venueName.toLowerCase().includes(q) ||
          e.city.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (selectedStatus === "ACTION_REQUIRED") {
      list = list.filter(
        (e) =>
          e.status === EventStatus.DRAFT ||
          e.status === EventStatus.PENDING_APPROVAL ||
          e.status === EventStatus.SUSPENDED
      );
    } else if (selectedStatus !== "ALL") {
      list = list.filter((e) => e.status === selectedStatus);
    }

    // City filter
    if (selectedCity !== "ALL") {
      list = list.filter((e) => e.city === selectedCity);
    }

    // Date range filter
    if (fromDate) {
      const t = new Date(fromDate).getTime();
      list = list.filter((e) => new Date(e.startTime).getTime() >= t);
    }
    if (toDate) {
      const t = new Date(toDate).getTime();
      list = list.filter((e) => new Date(e.startTime).getTime() <= t);
    }

    // Sorting: Upcoming & active first by date ascending; ended/cancelled at bottom
    list.sort((a, b) => {
      switch (selectedSort) {
        case "date_asc": {
          const aIsEndedOrPast =
            a.status === EventStatus.ENDED ||
            a.status === EventStatus.CANCELLED ||
            new Date(a.startTime).getTime() < nowMs;
          const bIsEndedOrPast =
            b.status === EventStatus.ENDED ||
            b.status === EventStatus.CANCELLED ||
            new Date(b.startTime).getTime() < nowMs;

          if (aIsEndedOrPast !== bIsEndedOrPast) {
            return aIsEndedOrPast ? 1 : -1;
          }
          return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
        }
        case "date_desc":
          return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
        case "title_asc":
          return a.title.localeCompare(b.title, "vi");
        case "revenue_desc":
          return b.revenue - a.revenue;
        case "sold_desc":
          return b.ticketsSold - a.ticketsSold;
        default:
          return 0;
      }
    });

    return list;
  }, [
    previewState,
    searchInput,
    selectedStatus,
    selectedCity,
    selectedSort,
    fromDate,
    toDate,
    nowMs,
  ]);

  // Pagination (20 per page per API contract)
  const pageSize = 20;
  const totalItems = filteredEvents.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, currentPage]);

  // Handle Summary Strip Filter Click
  const handleSummaryStripClick = (type: "SOLD" | "REVENUE" | "UPCOMING" | "ACTION") => {
    setCurrentPage(1);
    switch (type) {
      case "SOLD":
        setSelectedStatus("PUBLISHED");
        updateUrlParams({ status: "PUBLISHED", page: 1 });
        break;
      case "REVENUE":
        setSelectedSort("revenue_desc");
        updateUrlParams({ sort: "revenue_desc", page: 1 });
        break;
      case "UPCOMING":
        setSelectedStatus("PUBLISHED");
        setSelectedSort("date_asc");
        updateUrlParams({ status: "PUBLISHED", sort: "date_asc", page: 1 });
        break;
      case "ACTION":
        setSelectedStatus("ACTION_REQUIRED");
        updateUrlParams({ status: "ACTION_REQUIRED", page: 1 });
        break;
    }
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchInput("");
    setSelectedStatus("ALL");
    setSelectedCity("ALL");
    setSelectedSort("date_asc");
    setFromDate("");
    setToDate("");
    setCurrentPage(1);
    router.replace(pathname, { scroll: false });
  };

  const hasActiveFilters =
    Boolean(searchInput) ||
    selectedStatus !== "ALL" ||
    selectedCity !== "ALL" ||
    selectedSort !== "date_asc" ||
    Boolean(fromDate) ||
    Boolean(toDate);

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* 1. Header: Calm & task-oriented, no duplicate page CTA, no promo banner */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Sự kiện
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Quản lý và theo dõi hiệu suất phát hành vé các sự kiện của bạn.
        </p>
      </div>

      {/* 2. Compact Summary Strip (shorter height, cursor:pointer, chevron affordance, secondary metric line) */}
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

      {/* 3. Toolbar: Search, Filters, Sorting, Active Filter Chips (fits one row at 1280px) */}
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
                  : STATUS_SELECT_OPTIONS.find((s) => s.value === selectedStatus)?.label ||
                    selectedStatus}
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

      {/* 4. Data Table / State Views */}
      <div className="bg-background rounded-lg border border-border overflow-hidden">
        {/* Loading Skeleton State */}
        {previewState === "LOADING" && (
          <div className="p-6 space-y-4" role="status" aria-label="Đang tải dữ liệu sự kiện">
            <div className="h-4 bg-secondary rounded w-48 animate-pulse" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3.5 rounded-md border border-border/50 animate-pulse gap-4"
                >
                  <div className="flex items-center gap-3 w-1/3">
                    <div className="size-11 rounded-md bg-secondary shrink-0" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-secondary rounded w-3/4" />
                      <div className="h-3 bg-secondary rounded w-1/2" />
                    </div>
                  </div>
                  <div className="h-4 bg-secondary rounded w-1/5" />
                  <div className="h-4 bg-secondary rounded w-1/6" />
                  <div className="h-4 bg-secondary rounded w-1/8" />
                  <div className="h-8 bg-secondary rounded w-12" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* API Error State (matching contract error shape) */}
        {previewState === "ERROR" && (
          <div className="p-12 text-center space-y-3" role="alert">
            <div className="size-12 rounded-full bg-red-50 text-destructive flex items-center justify-center mx-auto">
              <AlertCircle className="size-6" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-bold text-foreground">
                Không thể tải danh sách sự kiện
              </h3>
              <p className="text-xs text-muted-foreground">
                Máy chủ trả về mã lỗi{" "}
                <code className="font-mono text-destructive">
                  INTERNAL_SERVER_ERROR (HTTP 500)
                </code>
                . Vui lòng kiểm tra kết nối mạng hoặc thử lại sau giây lát.
              </p>
              <p className="text-[11px] text-muted-foreground font-mono">
                Mã yêu cầu: req_01HZX890ABCDEF • {new Date().toISOString()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPreviewState("NORMAL")}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <RefreshCw className="size-3.5" />
              <span>Thử lại</span>
            </button>
          </div>
        )}

        {/* Empty List State (Zero events in account) */}
        {previewState === "NORMAL" && filteredEvents.length === 0 && !hasActiveFilters && (
          <div className="p-12 text-center space-y-3">
            <div className="size-12 rounded-full bg-secondary flex items-center justify-center mx-auto text-muted-foreground">
              <Calendar className="size-6" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="text-base font-bold text-foreground">
                Chưa có sự kiện nào
              </h3>
              <p className="text-xs text-muted-foreground">
                Bạn chưa khởi tạo sự kiện nào trên TicketHub. Hãy bắt đầu bằng cách tạo sự kiện đầu tiên.
              </p>
            </div>
            <Link
              href="/organizer/events/new"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
            >
              Tạo sự kiện ngay
            </Link>
          </div>
        )}

        {/* No Results State (Filters produced empty result) */}
        {previewState === "NORMAL" && filteredEvents.length === 0 && hasActiveFilters && (
          <div className="p-12 text-center space-y-3">
            <div className="size-12 rounded-full bg-secondary flex items-center justify-center mx-auto text-muted-foreground">
              <Search className="size-6" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="text-base font-bold text-foreground">
                Không tìm thấy sự kiện phù hợp
              </h3>
              <p className="text-xs text-muted-foreground">
                Không có sự kiện nào khớp với các bộ lọc bạn đã chọn. Vui lòng thử từ khóa khác hoặc xóa bộ lọc.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md border border-border bg-background text-xs font-semibold text-foreground hover:bg-secondary transition-colors cursor-pointer"
            >
              Xóa tất cả bộ lọc
            </button>
          </div>
        )}

        {/* Normal Data Table (P0: fits container at 1280px & 1440px; sticky columns below 1024px) */}
        {previewState === "NORMAL" && paginatedEvents.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs table-fixed">
              <colgroup>
                {/* Sự kiện: Flexible ~32% */}
                <col className="w-[32%] min-w-[240px]" />
                {/* Địa điểm: ~20% */}
                <col className="w-[20%] min-w-[160px]" />
                {/* Vé đã bán: ~18% */}
                <col className="w-[18%] min-w-[150px]" />
                {/* Doanh thu: ~14% */}
                <col className="w-[14%] min-w-[120px]" />
                {/* Trạng thái: ~11% */}
                <col className="w-[11%] min-w-[110px]" />
                {/* Thao tác: fixed 56px */}
                <col className="w-[5%] min-w-[56px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                  <th
                    scope="col"
                    className="py-3 px-4 sticky left-0 bg-muted z-10 lg:static lg:bg-transparent"
                  >
                    Sự kiện
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Địa điểm
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Vé đã bán
                  </th>
                  <th scope="col" className="py-3 px-4 text-right">
                    Doanh thu
                  </th>
                  <th scope="col" className="py-3 px-4 whitespace-nowrap">
                    Trạng thái
                  </th>
                  <th
                    scope="col"
                    className="py-3 px-4 text-right sticky right-0 bg-muted z-10 lg:static lg:bg-transparent"
                  >
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedEvents.map((event) => {
                  const displayStatus = getDisplayStatus(event);
                  const StatusIcon = getStatusIcon(displayStatus.key);
                  const soldPercent =
                    event.ticketsTotal > 0
                      ? Math.min(
                          100,
                          Math.round((event.ticketsSold / event.ticketsTotal) * 100)
                        )
                      : 0;

                  return (
                    <tr
                      key={event.id}
                      onClick={() => router.push(`/events/${event.slug}`)}
                      className="hover:bg-secondary/40 transition-colors cursor-pointer group"
                    >
                      {/* Sự kiện (Thumbnail or ImagePlaceholder, Name with tooltip, Date/Time) */}
                      <td className="py-3.5 px-4 sticky left-0 bg-background group-hover:bg-muted/80 transition-colors z-10 lg:static lg:bg-transparent">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative size-11 rounded-md overflow-hidden bg-secondary border border-border shrink-0">
                            {event.bannerUrl ? (
                              <Image
                                src={event.bannerUrl}
                                alt=""
                                fill
                                sizes="44px"
                                className="object-cover"
                              />
                            ) : (
                              <ImagePlaceholder
                                type="event"
                                category={event.category}
                                className="size-full"
                                iconClassName="size-4"
                              />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4
                              className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate"
                              title={event.title}
                            >
                              {event.title}
                            </h4>
                            <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5 truncate">
                              {formatDateTimeVi(event.startTime)}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Địa điểm (Venue + City) */}
                      <td className="py-3.5 px-4">
                        <p
                          className="text-xs font-medium text-foreground truncate"
                          title={event.venueName}
                        >
                          {event.venueName}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {event.city}
                        </p>
                      </td>

                      {/* Vé đã bán (Line 1: single line count; Line 2: fixed progress bar + % label) */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-foreground tabular-nums whitespace-nowrap">
                            {formatNumberVi(event.ticketsSold)} / {formatNumberVi(event.ticketsTotal)}
                          </div>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-1.5 flex-1 bg-secondary rounded-full overflow-hidden"
                              role="progressbar"
                              aria-valuenow={soldPercent}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            >
                              <div
                                className="h-full bg-primary transition-all duration-300"
                                style={{ width: `${soldPercent}%` }}
                              />
                            </div>
                            <span className="text-[10.5px] text-muted-foreground tabular-nums shrink-0 font-medium">
                              {soldPercent}%
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Doanh thu (Base UI font, tabular-nums, right-aligned, whitespace-nowrap) */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="font-semibold text-foreground tabular-nums text-xs">
                          {formatVnd(event.revenue)}
                        </span>
                      </td>

                      {/* Trạng thái (Pill with icon, label, semantic token, whitespace-nowrap, never clipped) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${displayStatus.badgeClass}`}
                        >
                          <StatusIcon className="size-3 shrink-0" />
                          <span>{displayStatus.label}</span>
                        </span>
                      </td>

                      {/* Thao tác: Fixed 56px actions cell with ⋯ menu */}
                      <td
                        className="py-3.5 px-4 text-right sticky right-0 bg-background group-hover:bg-muted/80 transition-colors z-10 lg:static lg:bg-transparent"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="relative inline-flex items-center justify-end">
                          <button
                            type="button"
                            aria-label={`Tùy chọn cho sự kiện ${event.title}`}
                            aria-haspopup="true"
                            aria-expanded={activeMenuId === event.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId((curr) =>
                                curr === event.id ? null : event.id
                              );
                            }}
                            className="size-8 rounded-md border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <MoreHorizontal className="size-4" />
                          </button>

                          {activeMenuId === event.id && (
                            <div
                              ref={menuContainerRef}
                              role="menu"
                              className="absolute right-0 top-full mt-1 w-48 rounded-md border border-border bg-popover text-popover-foreground shadow-lg py-1 z-30 text-left text-xs"
                            >
                              {/* Quick primary action if draft */}
                              {event.status === EventStatus.DRAFT && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(null);
                                    await publishOrganizerEvent(event.id);
                                    router.refresh();
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-secondary text-primary font-semibold transition-colors cursor-pointer"
                                >
                                  <CheckCircle2 className="size-3.5 text-primary" />
                                  <span>Phát hành ngay</span>
                                </button>
                              )}

                              <button
                                type="button"
                                role="menuitem"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(null);
                                  router.push(`/events/${event.slug}`);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-secondary text-foreground transition-colors cursor-pointer"
                              >
                                <Eye className="size-3.5 text-muted-foreground" />
                                <span>Xem chi tiết</span>
                              </button>

                              <button
                                type="button"
                                role="menuitem"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(null);
                                  router.push(`/events/${event.slug}`);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-secondary text-foreground transition-colors cursor-pointer"
                              >
                                <Layers className="size-3.5 text-muted-foreground" />
                                <span>Xem sơ đồ chỗ ngồi</span>
                              </button>

                              {(event.status === EventStatus.DRAFT ||
                                event.status === EventStatus.PENDING_APPROVAL ||
                                event.status === EventStatus.PUBLISHED) && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(null);
                                    router.push(`/organizer/events/new?edit=${event.id}`);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-secondary text-foreground transition-colors cursor-pointer"
                                >
                                  <Edit className="size-3.5 text-muted-foreground" />
                                  <span>Chỉnh sửa</span>
                                </button>
                              )}

                              <button
                                type="button"
                                role="menuitem"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(null);
                                  // TODO(contract): POST /api/v1/events/:id/clone
                                  await cloneOrganizerEvent(event.id);
                                  router.refresh();
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-secondary text-foreground transition-colors cursor-pointer"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Nhân bản</span>
                              </button>

                              {event.status === EventStatus.PUBLISHED && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(null);
                                    // TODO(contract): POST /api/v1/events/:id/pause
                                    await pauseOrganizerEvent(event.id);
                                    router.refresh();
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-secondary text-orange-700 transition-colors cursor-pointer"
                                >
                                  <Pause className="size-3.5" />
                                  <span>Tạm dừng bán</span>
                                </button>
                              )}

                              {(event.status === EventStatus.PUBLISHED ||
                                event.status === EventStatus.PENDING_APPROVAL) && (
                                <div className="border-t border-border mt-1 pt-1">
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      setActiveMenuId(null);
                                      // TODO(contract): POST /api/v1/events/:id/cancel
                                      await cancelOrganizerEvent(event.id);
                                      router.refresh();
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-destructive/10 text-destructive transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="size-3.5" />
                                    <span>Hủy sự kiện</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. Pagination Bar (hide prev/next when only 1 page) */}
        {previewState === "NORMAL" && filteredEvents.length > 0 && (
          <div className="p-3 sm:p-3.5 border-t border-border bg-background flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <p>
              Hiển thị{" "}
              <strong className="text-foreground tabular-nums">
                {(currentPage - 1) * pageSize + 1}
              </strong>{" "}
              -{" "}
              <strong className="text-foreground tabular-nums">
                {Math.min(currentPage * pageSize, totalItems)}
              </strong>{" "}
              trên tổng số{" "}
              <strong className="text-foreground tabular-nums">
                {totalItems}
              </strong>{" "}
              sự kiện (20 / trang)
            </p>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => {
                    const p = Math.max(1, currentPage - 1);
                    setCurrentPage(p);
                    updateUrlParams({ page: p });
                  }}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-border bg-background hover:bg-secondary text-foreground text-xs disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <ChevronLeft className="size-3.5" />
                  <span>Trang trước</span>
                </button>

                <span className="px-2 font-medium tabular-nums text-foreground">
                  {currentPage} / {totalPages}
                </span>

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => {
                    const p = Math.min(totalPages, currentPage + 1);
                    setCurrentPage(p);
                    updateUrlParams({ page: p });
                  }}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-border bg-background hover:bg-secondary text-foreground text-xs disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <span>Trang sau</span>
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dev-only Floating State Switcher */}
      {isDev && (
        <aside
          aria-label="Bảng điều khiển thử nghiệm nhà phát triển"
          className="fixed bottom-4 right-4 z-40 p-1.5 rounded-lg border border-border bg-background/95 backdrop-blur shadow-lg flex items-center gap-1 text-xs"
        >
          <span className="px-2 py-0.5 text-muted-foreground font-medium hidden sm:inline">
            Xem trước:
          </span>
          <button
            type="button"
            onClick={() => setPreviewState("NORMAL")}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              previewState === "NORMAL"
                ? "bg-secondary text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Bình thường
          </button>
          <button
            type="button"
            onClick={() => setPreviewState("LOADING")}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              previewState === "LOADING"
                ? "bg-secondary text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Đang tải
          </button>
          <button
            type="button"
            onClick={() => setPreviewState("EMPTY")}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              previewState === "EMPTY"
                ? "bg-secondary text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Trống
          </button>
          <button
            type="button"
            onClick={() => setPreviewState("ERROR")}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              previewState === "ERROR"
                ? "bg-secondary text-destructive font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Lỗi API
          </button>
        </aside>
      )}
    </div>
  );
}

export default function OrganizerEventsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[1200px] mx-auto px-4 py-8 text-xs text-muted-foreground">
          Đang tải trang sự kiện...
        </div>
      }
    >
      <OrganizerEventsContent />
    </Suspense>
  );
}
