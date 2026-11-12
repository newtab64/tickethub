import { randomBytes } from "node:crypto";
import { EventStatus, OrderStatus } from "@tickethub/shared";
import { bookingErrors } from "./booking.errors";
import type {
  BookingTicketType,
  HoldItem,
  OrderItemDraft,
  StandingInventory,
} from "./booking.models";

export const MAX_TICKETS_PER_ORDER = 6;
export const HOLD_DURATION_MS = 5 * 60 * 1000;
export const HOLD_DURATION_SECONDS = 300;

export const quantityOf = (item: HoldItem): number => item.quantity ?? 1;

export function assertEventOnSale(event: { status: string } | null): void {
  if (!event) throw bookingErrors.eventNotFound();
  if (event.status !== EventStatus.PUBLISHED) {
    throw bookingErrors.eventNotPublished();
  }
}

/** Toi da 6 ve tren mot giao dich. */
export function assertWithinTicketLimit(items: HoldItem[]): void {
  const total = items.reduce((sum, item) => sum + quantityOf(item), 0);
  if (total > MAX_TICKETS_PER_ORDER) throw bookingErrors.maxTicketsExceeded();
}

export function assertTicketTypesExist(
  items: HoldItem[],
  known: Map<string, BookingTicketType>,
): void {
  for (const item of items) {
    if (!known.has(item.ticketTypeId)) {
      throw bookingErrors.ticketTypeNotFound(item.ticketTypeId);
    }
  }
}

export interface ClassifiedItems {
  explicitSeated: HoldItem[];
  autoSeated: HoldItem[];
  standing: HoldItem[];
}

/**
 * Phan loai: ghe chi dinh (tuong thich nguoc, backend giu), tu dong phan bo
 * (chuan nghiep vu) va khu dung khong so ghe.
 */
export function classifyItems(
  items: HoldItem[],
  types: Map<string, BookingTicketType>,
): ClassifiedItems {
  return {
    explicitSeated: items.filter((i) => Boolean(i.seatId)),
    autoSeated: items.filter(
      (i) => !i.seatId && types.get(i.ticketTypeId)?.isSeated === true,
    ),
    standing: items.filter(
      (i) => !i.seatId && types.get(i.ticketTypeId)?.isSeated === false,
    ),
  };
}

export function assertNoDuplicateSeats(seatIds: string[]): void {
  if (new Set(seatIds).size !== seatIds.length) {
    throw bookingErrors.duplicateSeats();
  }
}

export function assertExplicitSeatsMatch(
  items: HoldItem[],
  seatTypeById: Map<string, string>,
): void {
  for (const item of items) {
    if (
      quantityOf(item) !== 1 ||
      seatTypeById.get(item.seatId!) !== item.ticketTypeId
    ) {
      throw bookingErrors.seatTicketTypeMismatch();
    }
  }
}

export function assertStandingAvailable(
  locked: StandingInventory | null,
  qty: number,
): StandingInventory {
  if (!locked || locked.isSeated)
    throw bookingErrors.invalidStandingTicketType();
  if (locked.soldCount + locked.heldCount + qty > locked.capacity) {
    throw bookingErrors.insufficientStanding();
  }
  return locked;
}

export function seatedLine(
  ticketTypeId: string,
  seatId: string,
  price: number,
): OrderItemDraft {
  return {
    ticketTypeId,
    seatId,
    quantity: 1,
    unitPrice: price.toFixed(2),
    subtotal: price.toFixed(2),
  };
}

export function standingLine(
  ticketTypeId: string,
  qty: number,
  price: number,
): OrderItemDraft {
  return {
    ticketTypeId,
    seatId: null,
    quantity: qty,
    unitPrice: price.toFixed(2),
    subtotal: (price * qty).toFixed(2),
  };
}

/** Ma don hang dang ORD-YYYYMMDD-XXXXXX (suffix ngau nhien). */
export function generateOrderCode(
  now: Date,
  randomSuffix: string = randomBytes(3).toString("hex").toUpperCase(),
): string {
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  return `ORD-${now.getFullYear()}${month}${day}-${randomSuffix}`;
}

export function assertReleasable(order: { status: string } | null): void {
  if (!order) throw bookingErrors.orderToReleaseNotFound();
  if (order.status !== OrderStatus.PENDING) {
    throw bookingErrors.orderNotPending(order.status);
  }
}
