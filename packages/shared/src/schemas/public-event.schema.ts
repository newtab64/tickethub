import { z } from "zod";

const PriceSchema = z
  .union([z.number(), z.string().regex(/^\d+(\.\d+)?$/)])
  .transform(Number)
  .pipe(z.number().int().nonnegative());
export const PublicTicketTypeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  price: PriceSchema,
  capacity: z.number().int().nonnegative(),
  heldCount: z.number().int().nonnegative(),
  soldCount: z.number().int().nonnegative(),
  isSeated: z.boolean(),
  saleStartTime: z.iso.datetime(),
  saleEndTime: z.iso.datetime(),
  maxPerOrder: z.number().int().positive(),
});
export const PublicEventSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  bannerUrl: z.string(),
  venueName: z.string(),
  venueAddress: z.string(),
  city: z.string(),
  startTime: z.iso.datetime(),
  endTime: z.iso.datetime(),
  gateOpeningTime: z.iso.datetime(),
  status: z.string(),
  ticketTypes: z.array(PublicTicketTypeSchema),
});
export const PublicEventListSchema = z.object({
  items: z.array(PublicEventSchema),
  total: z.number().int().nonnegative(),
});
export type PublicEvent = z.infer<typeof PublicEventSchema>;
