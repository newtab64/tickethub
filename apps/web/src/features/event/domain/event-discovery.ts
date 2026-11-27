import type { PublicEvent } from "@tickethub/shared";

export type CategoryCode = "ALL" | "CONCERT" | "SPORT" | "THEATER";

const CATEGORY_BY_NAME: Record<string, Exclude<CategoryCode, "ALL">> = {
  "Âm nhạc": "CONCERT",
  "Thể thao": "SPORT",
  "Sân khấu & Nghệ thuật": "THEATER",
};

/** Ma the loai cua giao dien; null voi gia tri la (chi hien o muc Tat ca). */
export function categoryCode(category: string) {
  return Object.hasOwn(CATEGORY_BY_NAME, category)
    ? CATEGORY_BY_NAME[category]!
    : null;
}

export interface EventCard {
  id: string;
  slug: string;
  title: string;
  category: Exclude<CategoryCode, "ALL"> | null;
  startTime: string;
  endTime: string;
  venueName: string;
  city: string;
  bannerUrl: string;
  minPrice: number | null;
}

/** Su kien con dien ra, sap theo ngay dien gan nhat. */
export function toEventCards(events: PublicEvent[], now: number): EventCard[] {
  return events
    .filter((event) => Date.parse(event.endTime) > now)
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))
    .map((event) => ({
      id: event.id,
      slug: event.slug,
      title: event.title,
      category: categoryCode(event.category),
      startTime: event.startTime,
      endTime: event.endTime,
      venueName: event.venueName,
      city: event.city,
      bannerUrl: event.bannerUrl,
      minPrice: event.ticketTypes.length
        ? Math.min(...event.ticketTypes.map((type) => type.price))
        : null,
    }));
}

export type DateFilter = "ALL" | "WEEKEND" | `${number}-${number}`;

const DAY = 24 * 60 * 60 * 1000;
// Viet Nam khong doi gio theo mua nen cong co dinh 7 gio.
const vietnamDate = (time: number) => new Date(time + 7 * 60 * 60 * 1000);
const dayKey = (time: number) => vietnamDate(time).toISOString().slice(0, 10);
const monthKey = (iso: string) =>
  dayKey(Date.parse(iso)).slice(0, 7) as DateFilter;

export function dateFilterOptions(cards: EventCard[]): DateFilter[] {
  const months = new Set(cards.map((card) => monthKey(card.startTime)));
  return ["ALL", "WEEKEND", ...[...months].sort()];
}

/** Thu Bay va Chu nhat sap toi; dang cuoi tuan thi la cuoi tuan nay. */
function weekendDays(now: number): string[] {
  const weekday = vietnamDate(now).getUTCDay();
  const toSaturday = weekday === 0 ? -1 : 6 - weekday;
  return [dayKey(now + toSaturday * DAY), dayKey(now + (toSaturday + 1) * DAY)];
}

const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase();

export function filterEventCards(
  cards: EventCard[],
  filter: {
    category: CategoryCode;
    city: string | null;
    date: DateFilter;
    query: string;
  },
  now: number,
): EventCard[] {
  const query = plain(filter.query.trim());
  const weekend = filter.date === "WEEKEND" ? weekendDays(now) : [];
  return cards.filter((card) => {
    if (filter.category !== "ALL" && card.category !== filter.category) {
      return false;
    }
    if (filter.city && card.city !== filter.city) return false;
    if (filter.date === "WEEKEND") {
      if (!weekend.includes(dayKey(Date.parse(card.startTime)))) return false;
    } else if (filter.date !== "ALL") {
      if (monthKey(card.startTime) !== filter.date) return false;
    }
    return plain(`${card.title} ${card.venueName} ${card.city}`).includes(
      query,
    );
  });
}
