import type { BuyerOrderQuery, OrderStatus } from "@tickethub/shared";

export type { BuyerOrderQuery };

export interface OrderEventSummary {
  id: string;
  title: string;
  slug: string;
  bannerUrl: string | null;
  venueName: string;
  venueAddress: string;
  city: string;
  startTime: Date;
  endTime: Date;
  status: string;
}

export interface OrderListRecord {
  id: string;
  orderCode: string;
  eventId: string;
  status: OrderStatus | string;
  totalAmount: string;
  discountAmount: string;
  finalAmount: string;
  expiresAt: Date;
  paidAt: Date | null;
  createdAt: Date;
  event: Pick<
    OrderEventSummary,
    "title" | "bannerUrl" | "startTime" | "venueName"
  >;
  items: Array<{ quantity: number }>;
}

export interface OrderListPage {
  total: number;
  orders: OrderListRecord[];
}

export interface OrderDetailRecord {
  id: string;
  orderCode: string;
  userId: string;
  status: OrderStatus | string;
  totalAmount: string;
  discountAmount: string;
  finalAmount: string;
  voucherCode: string | null;
  expiresAt: Date;
  paidAt: Date | null;
  createdAt: Date;
  event: OrderEventSummary;
  items: Array<{
    id: string;
    ticketTypeId: string;
    quantity: number;
    unitPrice: string;
    subtotal: string;
    ticketType: { name: string };
  }>;
  tickets: Array<{
    id: string;
    ticketCode: string;
    ticketTypeId: string;
    status: string;
    checkedInAt: Date | null;
    ticketType: { name: string; price: string; isSeated: boolean };
    seat: { zoneName: string; rowLabel: string; seatNumber: string } | null;
  }>;
  refunds: Array<{
    id: string;
    amount: string;
    status: string;
    reason: string;
    createdAt: Date;
  }>;
}
