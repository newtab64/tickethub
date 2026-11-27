import { and, eq } from "drizzle-orm";
import { EventStatus, RefundPolicyType, SeatStatus } from "@tickethub/shared";
import { db } from "./db";
import { events, seats, ticketTypes } from "./schema";
import { SAMPLE_EVENT_MAP, SEED_EVENTS, type SeedEvent } from "./catalog-data";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const HOUR = 60 * 60 * 1000;
const SEATS_PER_ROW = 10;

/** Moi hang ngoi chua co ghe nao thi sinh du `capacity` ghe. */
async function ensureSeats(tx: Tx, eventId: string) {
  const types = await tx
    .select()
    .from(ticketTypes)
    .where(
      and(eq(ticketTypes.eventId, eventId), eq(ticketTypes.isSeated, true)),
    );
  for (const type of types) {
    const existing = await tx
      .select({ id: seats.id })
      .from(seats)
      .where(eq(seats.ticketTypeId, type.id))
      .limit(1);
    if (existing.length > 0) continue;
    await tx.insert(seats).values(
      Array.from({ length: type.capacity }, (_, i) => ({
        eventId,
        ticketTypeId: type.id,
        zoneName: type.name,
        rowLabel: String.fromCharCode(65 + Math.floor(i / SEATS_PER_ROW)),
        seatNumber: String((i % SEATS_PER_ROW) + 1).padStart(2, "0"),
        status: SeatStatus.AVAILABLE,
      })),
    );
  }
}

async function insertEvent(tx: Tx, organizerId: string, seed: SeedEvent) {
  const { daysFromNow, ticketTypes: types, ...fields } = seed;
  const now = Date.now();
  const start = now + daysFromNow * 24 * HOUR;
  const [event] = await tx
    .insert(events)
    .values({
      ...fields,
      organizerId,
      startTime: new Date(start),
      endTime: new Date(start + 3 * HOUR),
      gateOpeningTime: new Date(start - 2 * HOUR),
      status: EventStatus.PUBLISHED,
      refundPolicyType: RefundPolicyType.FLEXIBLE,
      refundPolicyRules: [
        { hoursBeforeStart: 72, refundRate: 100 },
        { hoursBeforeStart: 24, refundRate: 50 },
      ],
    })
    .returning({ id: events.id });
  await tx.insert(ticketTypes).values(
    types.map((type, i) => ({
      ...type,
      eventId: event!.id,
      price: type.price.toFixed(2),
      saleStartTime: new Date(now - 24 * HOUR),
      saleEndTime: new Date(start - 2 * HOUR),
      sortOrder: i + 1,
    })),
  );
  return event!.id;
}

/** Bo sung su kien mau ban duoc. Chay lai nhieu lan khong tao trung. */
export async function seedCatalog(organizerId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const idOf = async (slug: string) =>
      (
        await tx
          .select({ id: events.id })
          .from(events)
          .where(eq(events.slug, slug))
      )[0]?.id;

    const sampleId = await idOf(SAMPLE_EVENT_MAP.slug);
    if (sampleId) {
      await tx
        .update(events)
        .set({
          mapKey: SAMPLE_EVENT_MAP.mapKey,
          bannerUrl: SAMPLE_EVENT_MAP.bannerUrl,
        })
        .where(eq(events.id, sampleId));
      for (const [name, mapZone] of Object.entries(SAMPLE_EVENT_MAP.zones)) {
        await tx
          .update(ticketTypes)
          .set({ mapZone })
          .where(
            and(eq(ticketTypes.eventId, sampleId), eq(ticketTypes.name, name)),
          );
      }
      await ensureSeats(tx, sampleId);
    }

    for (const seed of SEED_EVENTS) {
      const eventId =
        (await idOf(seed.slug)) ?? (await insertEvent(tx, organizerId, seed));
      await ensureSeats(tx, eventId);
    }
  });
}
