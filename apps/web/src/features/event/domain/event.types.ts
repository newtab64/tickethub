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
