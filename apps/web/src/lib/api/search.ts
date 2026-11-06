// apps/web/src/lib/api/search.ts
import { apiClient } from "./client";
import {
  EVENTS,
  formatVnd,
  type EventItem,
  type CategoryCode,
} from "../events-catalog";

export interface SearchFilterParams {
  keyword?: string;
  city?: string;
  category?: string;
  fromDate?: string;
  toDate?: string;
  minPrice?: number;
  maxPrice?: number;
  cursor?: string;
  limit?: number;
}

export interface CursorPaginatedEvents {
  items: EventItem[];
  nextCursor: string | null;
  hasMore: boolean;
  totalFiltered?: number;
}

const CITY_CODE_TO_NAME: Record<string, string> = {
  HCM: "TP. Hồ Chí Minh",
  HN: "Hà Nội",
  DN: "Đà Nẵng",
};

export function removeVietnameseTones(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function mapBackendEventToCatalogItem(raw: Record<string, unknown>): EventItem {
  const ticketTypes = Array.isArray(raw.ticketTypes) ? raw.ticketTypes : [];
  const prices = ticketTypes
    .map((t: unknown) => {
      if (t && typeof t === "object" && "price" in t) {
        return Number((t as { price?: unknown }).price);
      }
      return Number.NaN;
    })
    .filter((p: number) => !Number.isNaN(p) && p >= 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 500000;

  const startTimeRaw =
    typeof raw.startTime === "string" || typeof raw.startTime === "number"
      ? raw.startTime
      : null;
  const startDate = startTimeRaw ? new Date(startTimeRaw) : new Date();
  const day = String(startDate.getDate()).padStart(2, "0");
  const month = startDate.getMonth() + 1;
  const hours = String(startDate.getHours()).padStart(2, "0");
  const mins = String(startDate.getMinutes()).padStart(2, "0");

  const cityStr = String(raw.city || "TP. Hồ Chí Minh");
  const cityCode: "HCM" | "HN" | "DN" = removeVietnameseTones(cityStr).includes(
    "ha noi",
  )
    ? "HN"
    : removeVietnameseTones(cityStr).includes("da nang")
      ? "DN"
      : "HCM";

  const rawCat = String(raw.category || "CONCERT").toUpperCase();
  const category: Exclude<CategoryCode, "ALL"> =
    rawCat === "SPORT" || rawCat === "THEATER" || rawCat === "FESTIVAL"
      ? rawCat
      : "CONCERT";

  return {
    id: String(raw.id || raw.slug),
    title: String(raw.title || "Sự kiện TicketHub"),
    category,
    dateRange: `${day} Th${month} • ${hours}:${mins}`,
    fullDateTime: `${day} Th${month}, ${startDate.getFullYear()} • ${hours}:${mins}`,
    doorsOpenTime: "17:30",
    dateWindow: month === 12 ? "DEC" : "NOV",
    venue: String(raw.venueName || "Nhà thi đấu Trung tâm"),
    venueAddress: String(raw.venueAddress || cityStr),
    city: cityStr,
    cityCode,
    fromPrice: `${formatVnd(minPrice)}+`,
    minPriceNumber: minPrice,
    organizerName: "Ban Tổ Chức TicketHub",
    description: String(raw.description || ""),
    image: String(raw.bannerUrl || "/images/events/vn/anh-trai.jpg"),
    portraitImage: String(raw.bannerUrl || "/images/events/vn/anh-trai.jpg"),
  };
}

export function filterCatalogEventsWithCursor(
  params: SearchFilterParams,
  extraEvents: EventItem[] = [],
): CursorPaginatedEvents {
  const limit = params.limit ?? 6;
  const qNorm = params.keyword ? removeVietnameseTones(params.keyword) : "";

  const seenIds = new Set<string>();
  const combinedPool: EventItem[] = [];
  for (const item of [...extraEvents, ...EVENTS]) {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      combinedPool.push(item);
    }
  }

  const filtered = combinedPool.filter((ev) => {
    if (qNorm) {
      const haystack = removeVietnameseTones(
        `${ev.title} ${ev.venue} ${ev.city} ${ev.organizerName} ${ev.description}`,
      );
      if (!haystack.includes(qNorm)) return false;
    }

    if (params.city && params.city !== "ALL") {
      if (
        ev.cityCode !== params.city &&
        removeVietnameseTones(ev.city) !== removeVietnameseTones(params.city)
      ) {
        return false;
      }
    }

    if (params.category && params.category !== "ALL") {
      if (ev.category !== params.category) return false;
    }

    if (params.minPrice !== undefined && ev.minPriceNumber < params.minPrice) {
      return false;
    }
    if (params.maxPrice !== undefined && ev.minPriceNumber > params.maxPrice) {
      return false;
    }

    if (params.fromDate || params.toDate) {
      const evIsoDate = ev.dateWindow === "DEC" ? "2026-12-06" : "2026-11-22";
      if (params.fromDate && evIsoDate < params.fromDate) return false;
      if (params.toDate && evIsoDate > params.toDate) return false;
    }

    return true;
  });

  let startIndex = 0;
  if (params.cursor) {
    const cursorIdx = filtered.findIndex((item) => item.id === params.cursor);
    if (cursorIdx !== -1) {
      startIndex = cursorIdx + 1;
    }
  }

  const slice = filtered.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < filtered.length;
  const nextCursor =
    hasMore && slice.length > 0 ? slice[slice.length - 1]!.id : null;

  return {
    items: slice,
    nextCursor,
    hasMore,
    totalFiltered: filtered.length,
  };
}

export const searchApi = {
  searchEvents: async (
    params: SearchFilterParams,
  ): Promise<CursorPaginatedEvents> => {
    const query = new URLSearchParams();

    if (params.keyword?.trim()) query.set("keyword", params.keyword.trim());
    if (params.city && params.city !== "ALL") {
      query.set("city", CITY_CODE_TO_NAME[params.city] || params.city);
    }
    if (params.category && params.category !== "ALL") {
      query.set("category", params.category);
    }
    if (params.fromDate) {
      query.set(
        "fromDate",
        new Date(`${params.fromDate}T00:00:00.000Z`).toISOString(),
      );
    }
    if (params.toDate) {
      query.set(
        "toDate",
        new Date(`${params.toDate}T23:59:59.999Z`).toISOString(),
      );
    }
    if (params.minPrice !== undefined) {
      query.set("minPrice", String(params.minPrice));
    }
    if (params.maxPrice !== undefined) {
      query.set("maxPrice", String(params.maxPrice));
    }
    if (params.cursor && /^[0-9a-f-]{36}$/i.test(params.cursor)) {
      query.set("cursor", params.cursor);
    }
    query.set("limit", String(params.limit ?? 6));

    let dbItems: EventItem[] = [];
    try {
      const data = await apiClient<{
        items: Record<string, unknown>[];
        nextCursor: string | null;
        hasMore: boolean;
      }>(`/search/events?${query.toString()}`);

      if (data && Array.isArray(data.items)) {
        if (data.items.length >= (params.limit ?? 6) || data.hasMore) {
          return {
            items: data.items.map(mapBackendEventToCatalogItem),
            nextCursor: data.nextCursor,
            hasMore: Boolean(data.hasMore),
          };
        }
        dbItems = data.items.map(mapBackendEventToCatalogItem);
      }
    } catch {
      // Bỏ qua nếu API chưa phản hồi
    }

    return filterCatalogEventsWithCursor(params, dbItems);
  },
};
