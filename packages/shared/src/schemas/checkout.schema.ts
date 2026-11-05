import { z } from "zod";
import { OrderStatus } from "../constants/enums";

const MoneySchema = z
  .union([z.number(), z.string().regex(/^\d+(\.\d+)?$/)])
  .transform(Number)
  .pipe(z.number().finite().nonnegative());

export const CheckoutOrderSchema = z.object({
  id: z.string().uuid(),
  orderCode: z.string(),
  status: z.enum(OrderStatus),
  totalAmount: MoneySchema,
  discountAmount: MoneySchema,
  finalAmount: MoneySchema,
  voucherCode: z.string().nullable(),
  expiresAt: z.iso.datetime(),
  remainingSeconds: z.number().nonnegative(),
  event: z.object({
    id: z.string().uuid(),
    title: z.string(),
    slug: z.string(),
    venueName: z.string(),
    venueAddress: z.string(),
    city: z.string(),
    startTime: z.iso.datetime(),
  }),
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        quantity: z.number().int().positive(),
        unitPrice: MoneySchema,
        subtotal: MoneySchema,
        ticketType: z.object({
          id: z.string().uuid(),
          name: z.string(),
          isSeated: z.boolean(),
        }),
        seat: z
          .object({
            zoneName: z.string(),
            rowLabel: z.string(),
            seatNumber: z.string(),
          })
          .nullable(),
      }),
    )
    .min(1),
});
export type CheckoutOrder = z.infer<typeof CheckoutOrderSchema>;

export const VnpayPaymentResponseSchema = z.object({
  orderId: z.string().uuid(),
  transactionRef: z.string().min(1),
  paymentUrl: z.url(),
  amountVnd: z.number().int().nonnegative(),
  expiresAt: z.iso.datetime(),
});
