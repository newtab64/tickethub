import type { PublicEvent } from "@tickethub/shared";
import type { EventItem } from "./events-catalog";
import { money, dateTime } from "./checkout";

export function publicEventCard(event: PublicEvent, index: number): EventItem {
  const category = event.category.toLowerCase();
  const month = new Date(event.startTime).getUTCMonth() + 1;
  const min = event.ticketTypes.length
    ? Math.min(...event.ticketTypes.map((t) => t.price))
    : null;
  return {
    id: event.slug,
    title: event.title,
    category:
      category.includes("sport") || category.includes("thể thao")
        ? "SPORT"
        : category.includes("theater") || category.includes("sân khấu")
          ? "THEATER"
          : category.includes("festival") || category.includes("lễ hội")
            ? "FESTIVAL"
            : "CONCERT",
    dateRange: dateTime(event.startTime),
    fullDateTime: dateTime(event.startTime),
    doorsOpenTime: dateTime(event.gateOpeningTime),
    dateWindow: month === 11 ? "NOV" : month === 12 ? "DEC" : "OTHER",
    venue: event.venueName,
    venueAddress: event.venueAddress,
    city: event.city,
    cityCode: event.city.includes("Hà Nội")
      ? "HN"
      : event.city.includes("Hồ Chí Minh")
        ? "HCM"
        : event.city.includes("Đà Nẵng")
          ? "DN"
          : "OTHER",
    fromPrice: min === null ? "Chưa công bố giá" : `${money(min)}+`,
    minPriceNumber: min ?? 0,
    organizerName: "Ban tổ chức sự kiện",
    description: event.description,
    image: event.bannerUrl || "/file.svg",
    ...(index < 4 ? { featuredOrder: index + 1 } : {}),
    trendingOrder: index + 1,
  };
}
