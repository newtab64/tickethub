import { OrderStatus, TicketStatus, UserRole } from "@tickethub/shared";
import { refundErrors } from "./refund.errors";

export interface RefundActor {
  userId: string;
  role: string;
}

export interface RefundableOrder {
  id: string;
  orderCode: string;
  userId: string;
  eventId: string;
  status: string;
  totalAmount: number;
  finalAmount: number;
}

export interface RefundableTicket {
  id: string;
  ticketCode: string;
  status: string;
  ticketTypeId: string;
  seatId: string | null;
  eventId: string | null;
  unitPrice: number;
  seatLabel: string;
}

/** Chi chu don hang hoac ADMIN duoc thao tac (chong IDOR). */
export function assertCanAccessOrder(
  order: RefundableOrder,
  actor: RefundActor,
): void {
  if (order.userId !== actor.userId && actor.role !== UserRole.ADMIN) {
    throw refundErrors.accessDenied();
  }
}

export function assertOrderPaid(order: RefundableOrder): void {
  if (order.status !== OrderStatus.PAID) {
    throw refundErrors.orderNotPaid();
  }
}

export function assertPercentageEligible(refundPercentage: number): void {
  if (refundPercentage === 0) {
    throw refundErrors.policyNotEligible();
  }
}

/** Moi ve yeu cau phai ton tai trong don va dang o trang thai SOLD. */
export function assertTicketsRefundable(
  found: ReadonlyArray<Pick<RefundableTicket, "id" | "status">>,
  requestedIds: ReadonlyArray<string>,
): void {
  if (found.length !== requestedIds.length) {
    throw refundErrors.ticketsNotFound();
  }
  for (const t of found) {
    if (t.status !== TicketStatus.SOLD) {
      throw refundErrors.ticketNotEligible(t.id, t.status);
    }
  }
}

/**
 * Don hang chi chuyen sang REFUNDED khi tat ca ve da bi huy;
 * huy mot phan giu don o trang thai PAID.
 */
export function resolveOrderStatusAfterRefund(
  uncancelledTicketCount: number,
): OrderStatus {
  return uncancelledTicketCount === 0 ? OrderStatus.REFUNDED : OrderStatus.PAID;
}

/** Hoan tien toan phan khi lan hoan dau tien bang dung finalAmount. */
export function isPartialRefund(
  totalPreviouslyRefunded: number,
  totalRefundAmount: number,
  finalAmount: number,
): boolean {
  return !(totalPreviouslyRefunded === 0 && totalRefundAmount === finalAmount);
}
