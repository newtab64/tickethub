import type {
  CheckedInTicket,
  DynamicQrPayload,
  GateEventRef,
  LookupTicketRow,
  MyTicketsPage,
  MyTicketsQuery,
  QrSubject,
  QrTicketRecord,
  ScanTicketDetails,
  SignedQr,
  TicketStateRow,
} from "./ticketing.models";

export interface QrTokenService {
  sign(subject: QrSubject): SignedQr;
  /** Nem TicketingDomainError neu token sai dinh dang, chu ky hoac het han. */
  verify(token: string, maxSkewSeconds?: number): DynamicQrPayload;
}

export interface TicketQrReader {
  findForQr(ticketId: string): Promise<QrTicketRecord | null>;
}

export interface MyTicketsReader {
  list(userId: string, query: MyTicketsQuery): Promise<MyTicketsPage>;
}

export interface GateRepository {
  isStaffAssigned(eventId: string, staffUserId: string): Promise<boolean>;
  findEvent(eventId: string): Promise<GateEventRef | null>;
  gateBelongsToEvent(gateId: string, eventId: string): Promise<boolean>;

  /** UPDATE nguyen tu ... WHERE status = 'SOLD' RETURNING; null neu khong cap nhat duoc. */
  checkInIfSold(
    ticketId: string,
    staffUserId: string,
    gateId: string | null,
    now: Date,
  ): Promise<CheckedInTicket | null>;
  findTicketState(ticketId: string): Promise<TicketStateRow | null>;
  findScanDetails(ticketId: string): Promise<ScanTicketDetails | null>;

  findLookupTicket(
    ticketCode: string,
    eventId: string,
  ): Promise<LookupTicketRow | null>;
  /**
   * Soat ve thu cong: UPDATE nguyen tu va ghi audit log MANUAL_TICKET_CHECK_IN
   * trong cung mot transaction; null neu ve khong con SOLD.
   */
  checkInManually(input: {
    ticketId: string;
    staffUserId: string;
    staffRole: string;
    gateId: string | null;
    now: Date;
    audit: Record<string, unknown>;
  }): Promise<CheckedInTicket | null>;
}
