import { and, eq, ne, sql } from "drizzle-orm";
import {
  EventStatus,
  OutboxStatus,
  SeatStatus,
  TicketStatus,
} from "@tickethub/shared";
import { db } from "../../../database/db";
import {
  events,
  organizerProfiles,
  outbox,
  seats,
  ticketTypes,
  tickets,
} from "../../../database/schema";
import type {
  CreateEventRequest,
  EventRecord,
  EventUpdatePatch,
  EventWithTicketTypes,
  InventoryTicketType,
  OrganizerProfileRef,
  SeatPlan,
  SeatRow,
  SeatStatusCounts,
} from "../domain/event.models";
import type {
  EventReadRepository,
  EventRepository,
  OrganizerProfileLookup,
} from "../domain/event.ports";

export class DrizzleOrganizerProfileLookup implements OrganizerProfileLookup {
  async findByUserId(userId: string): Promise<OrganizerProfileRef | null> {
    const profile = await db.query.organizerProfiles.findFirst({
      where: eq(organizerProfiles.userId, userId),
    });
    return profile ? { id: profile.id, status: profile.status } : null;
  }
}

export class DrizzleEventRepository implements EventRepository {
  async slugExists(slug: string) {
    const existing = await db.query.events.findFirst({
      where: eq(events.slug, slug),
    });
    return Boolean(existing);
  }

  createWithTicketTypes(organizerId: string, dto: CreateEventRequest) {
    return db.transaction(async (tx) => {
      const [newEvent] = await tx
        .insert(events)
        .values({
          organizerId,
          title: dto.title,
          slug: dto.slug,
          description: dto.description,
          category: dto.category,
          bannerUrl: dto.bannerUrl,
          venueName: dto.venueName,
          venueAddress: dto.venueAddress,
          city: dto.city,
          startTime: new Date(dto.startTime),
          endTime: new Date(dto.endTime),
          gateOpeningTime: new Date(dto.gateOpeningTime),
          status: EventStatus.DRAFT,
          refundPolicyType: dto.refundPolicyType,
          refundPolicyRules: dto.refundPolicyRules,
          version: 1,
        })
        .returning();
      if (!newEvent) throw new Error("Không thể khởi tạo bản ghi sự kiện");

      const insertedTicketTypes = await tx
        .insert(ticketTypes)
        .values(
          dto.ticketTypes.map((tt) => ({
            eventId: newEvent.id,
            name: tt.name,
            description: tt.description,
            price: tt.price.toFixed(2),
            capacity: tt.capacity,
            isSeated: tt.isSeated,
            saleStartTime: new Date(tt.saleStartTime),
            saleEndTime: new Date(tt.saleEndTime),
            maxPerOrder: tt.maxPerOrder,
            sortOrder: tt.sortOrder,
          })),
        )
        .returning();

      await tx.insert(outbox).values({
        eventType: "EVENT_CREATED",
        payload: {
          eventId: newEvent.id,
          organizerId,
          title: newEvent.title,
        },
        status: OutboxStatus.PENDING,
      });

      return { ...newEvent, ticketTypes: insertedTicketTypes };
    });
  }

  listByOrganizer(organizerId: string) {
    return db.query.events.findMany({
      where: eq(events.organizerId, organizerId),
      with: { ticketTypes: true },
      orderBy: (e, { desc }) => [desc(e.createdAt)],
    });
  }

  async findOrganizerDetail(organizerId: string, eventId: string) {
    const event = await db.query.events.findFirst({
      where: and(eq(events.id, eventId), eq(events.organizerId, organizerId)),
      with: { ticketTypes: true, gates: true },
    });
    return event ?? null;
  }

  async countSeats(eventId: string) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(seats)
      .where(eq(seats.eventId, eventId));
    return row?.count ?? 0;
  }

  async countSeatsOfTicketType(eventId: string, ticketTypeId: string) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(seats)
      .where(
        and(eq(seats.eventId, eventId), eq(seats.ticketTypeId, ticketTypeId)),
      );
    return row?.count ?? 0;
  }

  async findOwned(organizerId: string, eventId: string) {
    const event = await db.query.events.findFirst({
      where: and(eq(events.id, eventId), eq(events.organizerId, organizerId)),
    });
    return event ?? null;
  }

  async findOwnedWithTicketTypes(organizerId: string, eventId: string) {
    const event = await db.query.events.findFirst({
      where: and(eq(events.id, eventId), eq(events.organizerId, organizerId)),
      with: { ticketTypes: true },
    });
    return event ?? null;
  }

  async hasNonCancelledTickets(eventId: string) {
    const sold = await db.query.tickets.findFirst({
      where: and(
        eq(tickets.eventId, eventId),
        ne(tickets.status, TicketStatus.CANCELLED),
      ),
    });
    return Boolean(sold);
  }

  async updateIfVersion(
    eventId: string,
    expectedVersion: number,
    patch: EventUpdatePatch,
  ): Promise<EventRecord | null> {
    const [updated] = await db
      .update(events)
      .set(patch)
      .where(and(eq(events.id, eventId), eq(events.version, expectedVersion)))
      .returning();
    return updated ?? null;
  }

  async replaceSeatLayout(
    eventId: string,
    nextVersion: number,
    plan: SeatPlan,
  ) {
    await db.transaction(async (tx) => {
      await tx.delete(seats).where(eq(seats.eventId, eventId));

      if (plan.seats.length > 0) {
        await tx.insert(seats).values(
          plan.seats.map((s) => ({
            eventId,
            ticketTypeId: s.ticketTypeId,
            zoneName: s.zoneName,
            rowLabel: s.rowLabel,
            seatNumber: s.seatNumber,
            status: SeatStatus.AVAILABLE,
            version: 1,
          })),
        );
      }

      for (const [ticketTypeId, capacity] of plan.capacityByTicketType) {
        await tx
          .update(ticketTypes)
          .set({ capacity, updatedAt: new Date() })
          .where(eq(ticketTypes.id, ticketTypeId));
      }

      await tx
        .update(events)
        .set({ version: nextVersion, updatedAt: new Date() })
        .where(eq(events.id, eventId));
    });
  }

  submitForApproval(event: EventWithTicketTypes, organizerId: string) {
    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(events)
        .set({
          status: EventStatus.PENDING_APPROVAL,
          version: event.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(events.id, event.id))
        .returning();

      await tx.insert(outbox).values({
        eventType: "EVENT_SUBMITTED_FOR_APPROVAL",
        payload: { eventId: event.id, organizerId, title: event.title },
        status: OutboxStatus.PENDING,
      });

      return {
        eventId: updated?.id,
        status: updated?.status,
        version: updated?.version,
      };
    });
  }

  listPublished(limit: number) {
    return db.query.events.findMany({
      where: eq(events.status, EventStatus.PUBLISHED),
      with: { ticketTypes: true },
      limit,
      orderBy: (e, { asc }) => [asc(e.startTime)],
    });
  }

  async findPublishedBySlug(slug: string) {
    const event = await db.query.events.findFirst({
      where: and(
        eq(events.slug, slug),
        eq(events.status, EventStatus.PUBLISHED),
      ),
      with: { ticketTypes: true },
    });
    return event ?? null;
  }
}

export class DrizzleEventReadRepository implements EventReadRepository {
  async findWithTicketTypes(eventId: string) {
    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
      with: { ticketTypes: true },
    });
    return event ?? null;
  }

  async listSeatsOrdered(eventId: string): Promise<SeatRow[]> {
    return db.query.seats.findMany({
      where: eq(seats.eventId, eventId),
      orderBy: [seats.zoneName, seats.rowLabel, seats.seatNumber],
    });
  }

  async publishedEventExists(eventId: string) {
    const event = await db.query.events.findFirst({
      where: and(
        eq(events.id, eventId),
        eq(events.status, EventStatus.PUBLISHED),
      ),
      columns: { id: true },
    });
    return Boolean(event);
  }

  listInventoryTicketTypes(eventId: string): Promise<InventoryTicketType[]> {
    return db.query.ticketTypes.findMany({
      where: eq(ticketTypes.eventId, eventId),
      columns: {
        id: true,
        name: true,
        price: true,
        capacity: true,
        heldCount: true,
        soldCount: true,
        isSeated: true,
      },
      orderBy: (table, { asc }) => [asc(table.sortOrder)],
    });
  }

  countSeatsByStatus(eventId: string): Promise<SeatStatusCounts[]> {
    return db
      .select({
        ticketTypeId: seats.ticketTypeId,
        available: sql<number>`
          COUNT(*) FILTER (
            WHERE ${seats.status} = ${SeatStatus.AVAILABLE}
            OR (
              ${seats.status} = ${SeatStatus.HELD}
              AND ${seats.holdExpiresAt} < NOW()
            )
          )::integer
        `,
        held: sql<number>`
          COUNT(*) FILTER (
            WHERE ${seats.status} = ${SeatStatus.HELD}
            AND (
              ${seats.holdExpiresAt} IS NULL
              OR ${seats.holdExpiresAt} >= NOW()
            )
          )::integer
        `,
        sold: sql<number>`
          COUNT(*) FILTER (
            WHERE ${seats.status} = ${SeatStatus.SOLD}
          )::integer
        `,
        blocked: sql<number>`
          COUNT(*) FILTER (
            WHERE ${seats.status} = ${SeatStatus.BLOCKED}
          )::integer
        `,
      })
      .from(seats)
      .where(eq(seats.eventId, eventId))
      .groupBy(seats.ticketTypeId);
  }
}
