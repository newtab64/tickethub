import type {
  AllocatedSeatItem,
  HoldSeatsRequest,
  OrderStatus,
} from "@tickethub/shared";

export type { AllocatedSeatItem, HoldSeatsRequest };

export type HoldItem = HoldSeatsRequest["items"][number];

export interface CandidateSeat {
  id: string;
  zoneName: string;
  rowLabel: string;
  seatNumber: string;
  ticketTypeId: string;
}

export interface LockedExplicitSeat extends CandidateSeat {
  status: string;
}

export interface BookingTicketType {
  id: string;
  price: string;
  isSeated: boolean;
}

export interface BookingEventRef {
  id: string;
  status: string;
}

export interface StandingInventory {
  id: string;
  capacity: number;
  heldCount: number;
  soldCount: number;
  isSeated: boolean;
}

export interface OrderItemDraft {
  ticketTypeId: string;
  seatId: string | null;
  quantity: number;
  unitPrice: string;
  subtotal: string;
}

export interface NewPendingOrder {
  orderCode: string;
  userId: string;
  eventId: string;
  totalAmount: string;
  expiresAt: Date;
}

export interface HoldResult {
  orderId: string;
  orderCode: string;
  heldSeats: string[];
  allocatedSeats: AllocatedSeatItem[];
  totalAmount: number;
  holdExpiresAt: string;
  remainingSeconds: number;
}

export interface PendingOrderForRelease {
  id: string;
  eventId: string;
  status: OrderStatus | string;
  items: Array<{
    seatId: string | null;
    ticketTypeId: string;
    quantity: number;
  }>;
}

export interface ReleasedSeatRecord {
  id: string;
  eventId: string;
}

export interface ExpirySweepResult {
  expiredOrdersCount: number;
  affectedEventIds: string[];
  releasedSeatRecords: ReleasedSeatRecord[];
}

/** Don hang kem quan he (hinh dang day du nhu API cong bo). */
export type BookingOrderView = { id: string; expiresAt: Date } & Record<
  string,
  unknown
>;
