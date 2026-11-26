import type { RefundExecuteResponse } from "@tickethub/shared";
import type { RefundableOrder, RefundableTicket } from "./refund-rules";

export interface RefundEventInfo {
  refundPolicyType: string | null;
  startTime: Date;
}

/** Cong doc (khong giao dich) dung cho xem truoc hoan tien. */
export interface RefundQueryPort {
  findOrderWithEvent(
    orderId: string,
  ): Promise<{ order: RefundableOrder; event: RefundEventInfo | null } | null>;
  findOrderTickets(
    orderId: string,
    ticketIds: string[],
  ): Promise<RefundableTicket[]>;
  sumRefundedAmount(orderId: string): Promise<number>;
  findIdempotentResponse(key: string): Promise<RefundExecuteResponse | null>;
}

export interface NewRefundRecord {
  ticketId: string;
  amount: number;
  idempotencyKey: string;
}

export interface RefundRequestedOutboxPayload {
  orderId: string;
  orderCode: string;
  refundIds: string[];
  ticketIds: string[];
  userId: string;
  eventId: string;
  amount: number;
  reason: string;
  isPartial: boolean;
  requestedAt: string;
}

/** Cong ghi trong mot Database Transaction duy nhat. */
export interface RefundTransaction {
  lockOrder(orderId: string): Promise<RefundableOrder | null>;
  lockTickets(
    orderId: string,
    ticketIds: string[],
  ): Promise<RefundableTicket[]>;
  findEvent(eventId: string): Promise<RefundEventInfo | null>;
  sumRefundedAmount(orderId: string): Promise<number>;
  cancelTickets(ticketIds: string[], at: Date): Promise<void>;
  releaseSeats(seatIds: string[], at: Date): Promise<void>;
  decrementSoldCount(
    countsByTicketType: ReadonlyMap<string, number>,
    at: Date,
  ): Promise<void>;
  insertRefunds(
    orderId: string,
    reason: string,
    rows: NewRefundRecord[],
  ): Promise<string[]>;
  countUncancelledTickets(orderId: string): Promise<number>;
  markOrderRefunded(orderId: string, at: Date): Promise<void>;
  enqueueRefundRequested(payload: RefundRequestedOutboxPayload): Promise<void>;
  writeAuditLog(entry: {
    actorId: string;
    actorRole: string;
    orderId: string;
    changes: Record<string, unknown>;
  }): Promise<void>;
  saveIdempotentResponse(
    key: string,
    userId: string,
    response: RefundExecuteResponse,
  ): Promise<void>;
}

export interface RefundUnitOfWork {
  run<T>(work: (tx: RefundTransaction) => Promise<T>): Promise<T>;
}

/** Tac dong phu sau commit (invalidate cache, phat SSE) thuoc context Events. */
export interface RefundNotifier {
  ticketsReleased(input: {
    eventId: string;
    seatIdsByEvent: ReadonlyMap<string, string[]>;
  }): Promise<void>;
}

export const REFUND_QUERY_PORT = Symbol("REFUND_QUERY_PORT");
export const REFUND_UNIT_OF_WORK = Symbol("REFUND_UNIT_OF_WORK");
export const REFUND_NOTIFIER = Symbol("REFUND_NOTIFIER");
