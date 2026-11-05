import { z } from "zod";
import { OrderStatus, TicketStatus } from "../constants/enums";

export const BuyerOrderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.nativeEnum(OrderStatus).optional(),
});
export type BuyerOrderQuery = z.infer<typeof BuyerOrderQuerySchema>;

export const MyTicketsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(TicketStatus).optional(),
  eventId: z.string().uuid().optional(),
});
export type MyTicketsQuery = z.infer<typeof MyTicketsQuerySchema>;

export interface BuyerOrderSummaryItem {
  id: string;
  orderCode: string;
  eventId: string;
  eventTitle: string;
  eventBannerUrl: string;
  eventStartTime: string;
  eventVenueName: string;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  status: OrderStatus;
  expiresAt: string;
  paidAt: string | null;
  createdAt: string;
  ticketCount: number;
}

export interface BuyerOrderListResponse {
  items: BuyerOrderSummaryItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface BuyerOrderDetailTicketItem {
  id: string;
  ticketCode: string;
  ticketTypeId: string;
  ticketTypeName: string;
  isSeated: boolean;
  seatInfo: {
    zoneName: string;
    rowLabel: string | null;
    seatNumber: string | null;
    formattedLabel: string;
  };
  price: number;
  effectivePaidPrice: number;
  status: TicketStatus;
  checkedInAt: string | null;
}

export interface BuyerOrderDetailResponse {
  id: string;
  orderCode: string;
  status: OrderStatus;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  voucherCode: string | null;
  expiresAt: string;
  paidAt: string | null;
  createdAt: string;
  event: {
    id: string;
    title: string;
    slug: string;
    bannerUrl: string;
    venueName: string;
    venueAddress: string;
    city: string;
    startTime: string;
    endTime: string;
    status: string;
  };
  items: Array<{
    id: string;
    ticketTypeId: string;
    ticketTypeName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  tickets: BuyerOrderDetailTicketItem[];
  refunds: Array<{
    id: string;
    amount: number;
    status: string;
    reason: string | null;
    createdAt: string;
  }>;
}

export interface MyTicketItem {
  id: string;
  ticketCode: string;
  status: TicketStatus;
  price: number;
  effectivePaidPrice: number;
  checkedInAt: string | null;
  orderId: string;
  orderCode: string;
  eventId: string;
  eventTitle: string;
  eventBannerUrl: string;
  eventStartTime: string;
  eventEndTime: string;
  eventVenueName: string;
  eventCity: string;
  eventStatus: string;
  ticketTypeId: string;
  ticketTypeName: string;
  isSeated: boolean;
  seatInfo: {
    zoneName: string;
    rowLabel: string | null;
    seatNumber: string | null;
    formattedLabel: string;
  };
}

export interface MyTicketsListResponse {
  items: MyTicketItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const BuyerOrderSummarySchema = z.object({
  id: z.string().uuid(),
  orderCode: z.string(),
  eventId: z.string().uuid(),
  eventTitle: z.string(),
  eventBannerUrl: z.string(),
  eventStartTime: z.iso.datetime(),
  eventVenueName: z.string(),
  totalAmount: z.number().nonnegative(),
  discountAmount: z.number().nonnegative(),
  finalAmount: z.number().nonnegative(),
  status: z.enum(OrderStatus),
  expiresAt: z.iso.datetime(),
  paidAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  ticketCount: z.number().int().nonnegative(),
});

export const BuyerOrderDetailSchema = z.object({
  id: z.string().uuid(),
  orderCode: z.string(),
  status: z.enum(OrderStatus),
  totalAmount: z.number().nonnegative(),
  discountAmount: z.number().nonnegative(),
  finalAmount: z.number().nonnegative(),
  voucherCode: z.string().nullable(),
  expiresAt: z.iso.datetime(),
  paidAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  event: z.object({
    id: z.string().uuid(),
    title: z.string(),
    slug: z.string(),
    bannerUrl: z.string(),
    venueName: z.string(),
    venueAddress: z.string(),
    city: z.string(),
    startTime: z.iso.datetime(),
    endTime: z.iso.datetime(),
    status: z.string(),
  }),
  items: z.array(
    z.object({
      id: z.string().uuid(),
      ticketTypeId: z.string().uuid(),
      ticketTypeName: z.string(),
      quantity: z.number().int().positive(),
      unitPrice: z.number().nonnegative(),
      subtotal: z.number().nonnegative(),
    }),
  ),
  tickets: z.array(
    z.object({
      id: z.string().uuid(),
      ticketCode: z.string(),
      ticketTypeId: z.string().uuid(),
      ticketTypeName: z.string(),
      isSeated: z.boolean(),
      seatInfo: z.object({
        zoneName: z.string(),
        rowLabel: z.string().nullable(),
        seatNumber: z.string().nullable(),
        formattedLabel: z.string(),
      }),
      price: z.number().nonnegative(),
      effectivePaidPrice: z.number().nonnegative(),
      status: z.enum(TicketStatus),
      checkedInAt: z.iso.datetime().nullable(),
    }),
  ),
  refunds: z.array(
    z.object({
      id: z.string().uuid(),
      amount: z.number().nonnegative(),
      status: z.string(),
      reason: z.string().nullable(),
      createdAt: z.iso.datetime(),
    }),
  ),
});
