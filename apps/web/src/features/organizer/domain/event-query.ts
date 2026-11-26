import { EventStatus } from "@tickethub/shared";
import type {
  OrganizerEventItem,
  OrganizerEventsQuery,
  OrganizerEventsResponse,
  OrganizerMetrics,
} from "./organizer.types";

/** Loc, tim kiem, sap xep va phan trang danh sach su kien cua Ban to chuc. */
export function queryOrganizerEvents(
  events: OrganizerEventItem[],
  query: OrganizerEventsQuery = {},
  nowMs: number = Date.now(),
): OrganizerEventsResponse {
  const {
    keyword = "",
    status = "ALL",
    city = "",
    fromDate = "",
    toDate = "",
    sort = "date_asc",
    limit = 20,
  } = query;

  // Filter list
  let filtered = [...events];

  // Search keyword (case & accent insensitive)
  if (keyword.trim()) {
    const q = keyword.trim().toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.venueName.toLowerCase().includes(q) ||
        item.city.toLowerCase().includes(q),
    );
  }

  // Status filter
  if (status === "ACTION_REQUIRED") {
    filtered = filtered.filter(
      (item) =>
        item.status === EventStatus.DRAFT ||
        item.status === EventStatus.PENDING_APPROVAL ||
        item.status === EventStatus.SUSPENDED,
    );
  } else if (status !== "ALL") {
    filtered = filtered.filter((item) => item.status === status);
  }

  // City filter
  if (city && city !== "ALL") {
    filtered = filtered.filter((item) => item.city === city);
  }

  // Date range filter
  if (fromDate) {
    const fromTime = new Date(fromDate).getTime();
    if (!isNaN(fromTime)) {
      filtered = filtered.filter(
        (item) => new Date(item.startTime).getTime() >= fromTime,
      );
    }
  }
  if (toDate) {
    const toTime = new Date(toDate).getTime();
    if (!isNaN(toTime)) {
      filtered = filtered.filter(
        (item) => new Date(item.startTime).getTime() <= toTime,
      );
    }
  }

  // Sorting
  filtered.sort((a, b) => {
    switch (sort) {
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
        return (
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );
    }
  });

  const totalCount = filtered.length;
  const items = filtered.slice(0, limit);
  const nextCursor =
    filtered.length > limit ? (filtered[limit - 1]?.id ?? null) : null;
  const hasMore = filtered.length > limit;

  return {
    items,
    nextCursor,
    hasMore,
    totalCount,
  };
}

/** Chi so tong hop cho thanh tom tat cua cong Ban to chuc. */
export function computeOrganizerMetrics(
  all: OrganizerEventItem[],
  now: number = Date.now(),
): OrganizerMetrics {
  const totalSoldTickets = all.reduce((sum, e) => sum + e.ticketsSold, 0);
  const totalRevenue = all.reduce((sum, e) => sum + e.revenue, 0);
  const upcomingEventsCount = all.filter(
    (e) =>
      e.status === EventStatus.PUBLISHED &&
      new Date(e.startTime).getTime() >= now,
  ).length;
  const actionRequiredCount = all.filter(
    (e) =>
      e.status === EventStatus.DRAFT ||
      e.status === EventStatus.PENDING_APPROVAL ||
      e.status === EventStatus.SUSPENDED,
  ).length;

  return {
    totalSoldTickets,
    totalRevenue,
    upcomingEventsCount,
    actionRequiredCount,
  };
}
