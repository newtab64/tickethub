import { z } from "zod";

export const PublicTicketTypeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  // Cot numeric cua PostgreSQL tra ve dang chuoi "600000.00".
  price: z.coerce.number().nonnegative(),
  capacity: z.number().int().nonnegative(),
  heldCount: z.number().int().nonnegative(),
  soldCount: z.number().int().nonnegative(),
  isSeated: z.boolean(),
  saleStartTime: z.string().datetime(),
  saleEndTime: z.string().datetime(),
  maxPerOrder: z.number().int().positive(),
  mapZone: z.string().nullable(),
});
export type PublicTicketType = z.infer<typeof PublicTicketTypeSchema>;

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
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  gateOpeningTime: z.string().datetime(),
  mapKey: z.string().nullable(),
  ticketTypes: z.array(PublicTicketTypeSchema),
});
export type PublicEvent = z.infer<typeof PublicEventSchema>;
