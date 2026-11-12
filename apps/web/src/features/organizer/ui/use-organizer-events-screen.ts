"use client";

import type { PreviewState } from "./organizer-events-content-helpers";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { EventStatus } from "@tickethub/shared";
import { MOCK_ORGANIZER_EVENTS } from "../data/mock-organizer-events";

/** Trang thai va hanh dong cua man hinh. */
export function useOrganizerEventsScreen() {
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
    queryPreview === "LOADING" ||
      queryPreview === "EMPTY" ||
      queryPreview === "ERROR"
      ? queryPreview
      : "NORMAL",
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
    [searchParams, router, pathname],
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
        new Date(e.startTime).getTime() >= nowMs,
    ).length;
    const actionRequiredCount = all.filter(
      (e) =>
        e.status === EventStatus.DRAFT ||
        e.status === EventStatus.PENDING_APPROVAL ||
        e.status === EventStatus.SUSPENDED,
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
          e.city.toLowerCase().includes(q),
      );
    }

    // Status filter
    if (selectedStatus === "ACTION_REQUIRED") {
      list = list.filter(
        (e) =>
          e.status === EventStatus.DRAFT ||
          e.status === EventStatus.PENDING_APPROVAL ||
          e.status === EventStatus.SUSPENDED,
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
          return (
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
          );
        }
        case "date_desc":
          return (
            new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
          );
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
  const handleSummaryStripClick = (
    type: "SOLD" | "REVENUE" | "UPCOMING" | "ACTION",
  ) => {
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

  return {
    router,
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
    currentPage,
    setCurrentPage,
    previewState,
    setPreviewState,
    isDev,
    activeMenuId,
    setActiveMenuId,
    menuContainerRef,
    updateUrlParams,
    metrics,
    filteredEvents,
    pageSize,
    totalItems,
    totalPages,
    paginatedEvents,
    handleSummaryStripClick,
    handleClearFilters,
    hasActiveFilters,
  };
}

export type OrganizerEventsScreen = ReturnType<typeof useOrganizerEventsScreen>;
