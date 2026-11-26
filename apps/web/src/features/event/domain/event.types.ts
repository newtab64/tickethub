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

export interface TicketListing {
  id: string;
  eventId: string;
  zoneId: string;
  zoneName: string;
  section: string;
  row?: string;
  seatInfo: string;
  price: number;
  originalPrice?: number;
  availableTickets: number;
  dealScore: number;
  dealLabel: "Tuyệt vời" | "Rất tốt" | "Tốt";
  features: string[];
  viewFromSeatUrl: string;
  isLastTickets?: boolean;
  isStanding?: boolean;
}
