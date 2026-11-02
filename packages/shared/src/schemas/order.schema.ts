import { z } from "zod";
export const HoldSeatItemSchema = z.object({
  seatId: z.string().uuid().optional(),
  ticketTypeId: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
});
export type HoldSeatItem = z.infer<typeof HoldSeatItemSchema>;

export const HoldSeatsRequestSchema = z.object({
  eventId: z.string().uuid(),

  items: z.array(HoldSeatItemSchema).min(1).max(6),

  voucherCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,50}$/)
    .optional(),
});

export type HoldSeatsRequest = z.infer<typeof HoldSeatsRequestSchema>;

export const AllocatedSeatItemSchema = z.object({
  id: z.string().uuid(),
  zoneName: z.string(),
  rowLabel: z.string(),
  seatNumber: z.string(),
});
export type AllocatedSeatItem = z.infer<typeof AllocatedSeatItemSchema>;

export const HoldSeatsResponseDataSchema = z.object({
  orderId: z.string().uuid(),
  orderCode: z.string(),

  heldSeats: z.array(z.string().uuid()),

  allocatedSeats: z.array(AllocatedSeatItemSchema).default([]),

  totalAmount: z.number(),

  discountAmount: z.number(),
  finalAmount: z.number(),

  voucherCode: z.string().nullable(),

  holdExpiresAt: z.string(),
  remainingSeconds: z.number(),
});

export type HoldSeatsResponseData = z.infer<typeof HoldSeatsResponseDataSchema>;

export const ReleaseHoldRequestSchema = z.object({
  orderId: z.string().uuid(),
});
export type ReleaseHoldRequest = z.infer<typeof ReleaseHoldRequestSchema>;

export const CreatePaymentRequestSchema = z.object({
  orderId: z.string().uuid(),
  voucherCode: z.string().optional(),

  bankCode: z.string().optional(),
});
export type CreatePaymentRequest = z.infer<typeof CreatePaymentRequestSchema>;
