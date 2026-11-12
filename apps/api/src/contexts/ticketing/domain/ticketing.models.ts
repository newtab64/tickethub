import type {
  GateLookupRequest,
  GateScanRequest,
  MyTicketsQuery,
} from "@tickethub/shared";

export type { GateLookupRequest, GateScanRequest, MyTicketsQuery };

export interface DynamicQrPayload {
  /** ticketId */
  sub: string;
  eventId: string;
  orderId: string;
  userId: string;
  nonce: string;
  iat: number;
  exp: number;
}

export interface QrSubject {
  sub: string;
  eventId: string;
  orderId: string;
  userId: string;
}

export interface SignedQr {
  token: string;
  expiresAt: Date;
  remainingSeconds: number;
}

export interface QrTicketRecord {
  id: string;
  userId: string;
  orderId: string;
  eventId: string;
  status: string;
  eventStatus: string;
}

export interface GateEventRef {
  id: string;
  status: string;
  title: string;
}

export interface TicketSeatFields {
  isSeated: boolean;
  zoneName: string | null;
  rowLabel: string | null;
  seatNumber: string | null;
}

export interface ScanTicketDetails extends TicketSeatFields {
  ticketCode: string;
  ticketTypeName: string;
  buyerName: string;
}

export interface CheckedInTicket {
  id: string;
  ticketCode: string;
  status: string;
  checkedInAt: Date;
  gateId: string | null;
}

export interface TicketStateRow {
  id: string;
  status: string;
  checkedInAt: Date | null;
  checkedInBy: string | null;
}

export interface LookupTicketRow extends TicketSeatFields {
  id: string;
  userId: string;
  status: string;
  ticketCode: string;
  buyerPhone: string | null;
  buyerEmail: string | null;
  buyerName: string;
  ticketTypeName: string;
}

export interface CheckInActor {
  staffUserId: string;
  staffRole: string;
}

export interface MyTicketRow {
  ticketId: string;
  ticketCode: string;
  ticketStatus: string;
  checkedInAt: Date | null;
  orderId: string;
  orderCode: string;
  orderTotalAmount: string;
  orderFinalAmount: string;
  eventId: string;
  eventTitle: string;
  eventBannerUrl: string | null;
  eventStartTime: Date;
  eventEndTime: Date;
  eventVenueName: string;
  eventCity: string;
  eventStatus: string;
  ticketTypeId: string;
  ticketTypeName: string;
  ticketTypePrice: string;
  isSeated: boolean;
  seatId: string | null;
  seatZoneName: string | null;
  seatRowLabel: string | null;
  seatNumber: string | null;
}

export interface MyTicketsPage {
  total: number;
  rows: MyTicketRow[];
}
