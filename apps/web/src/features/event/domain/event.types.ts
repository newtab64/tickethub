export type CategoryCode = "ALL" | "CONCERT" | "SPORT" | "THEATER" | "FESTIVAL";

export interface EventItem {
  id: string;
  title: string;
  category: Exclude<CategoryCode, "ALL">;
  dateRange: string;
  fullDateTime: string;
  doorsOpenTime: string;
  dateWindow: "WEEKEND" | "NOV" | "DEC";
  venue: string;
  venueAddress: string;
  city: string;
  cityCode: "HCM" | "HN" | "DN";
  fromPrice: string;
  minPriceNumber: number;
  organizerName: string;
  description: string;
  image: string;
  portraitImage?: string;
  featuredOrder?: number;
  trendingOrder?: number;
}

/** Mot hang ve tren man hinh dat ve. */
export interface TicketListing {
  id: string;
  eventId: string;
  /** Ma data-zone tren so do; rong khi hang ve khong gan khu. */
  zoneId: string;
  zoneName: string;
  price: number;
  availableTickets: number;
  maxPerOrder: number;
  onSale: boolean;
  isStanding: boolean;
}
