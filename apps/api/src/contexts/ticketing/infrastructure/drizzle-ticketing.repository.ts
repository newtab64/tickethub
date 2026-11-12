import { and, asc, count, eq, inArray } from "drizzle-orm";
import { TicketStatus } from "@tickethub/shared";
import { db } from "../../../database/db";
import {
  auditLog,
  eventStaff,
  events,
  gates,
  orders,
  seats,
  ticketTypes,
  tickets,
  users,
} from "../../../database/schema";
import type {
  CheckedInTicket,
  GateEventRef,
  LookupTicketRow,
  MyTicketsPage,
  MyTicketsQuery,
  QrTicketRecord,
  ScanTicketDetails,
  TicketStateRow,
} from "../domain/ticketing.models";
import type {
  GateRepository,
  MyTicketsReader,
  TicketQrReader,
} from "../domain/ticketing.ports";

function checkInValues(staffUserId: string, gateId: string | null, now: Date) {
  return {
    status: TicketStatus.CHECKED_IN,
    checkedInAt: now,
    checkedInBy: staffUserId,
    gateId,
    updatedAt: now,
  };
}

function toCheckedIn(row: typeof tickets.$inferSelect): CheckedInTicket {
  return {
    id: row.id,
    ticketCode: row.ticketCode,
    status: row.status,
    checkedInAt: row.checkedInAt!,
    gateId: row.gateId ?? null,
  };
}

export class DrizzleTicketQrReader implements TicketQrReader {
  async findForQr(ticketId: string): Promise<QrTicketRecord | null> {
    const [ticket] = await db
      .select({
        id: tickets.id,
        userId: tickets.userId,
        orderId: tickets.orderId,
        eventId: tickets.eventId,
        status: tickets.status,
        eventStatus: events.status,
      })
      .from(tickets)
      .innerJoin(events, eq(tickets.eventId, events.id))
      .where(eq(tickets.id, ticketId))
      .limit(1);
    return ticket ?? null;
  }
}

export class DrizzleGateRepository implements GateRepository {
  async isStaffAssigned(eventId: string, staffUserId: string) {
    const [assignment] = await db
      .select({ id: eventStaff.id })
      .from(eventStaff)
      .where(
        and(
          eq(eventStaff.eventId, eventId),
          eq(eventStaff.userId, staffUserId),
        ),
      )
      .limit(1);
    return Boolean(assignment);
  }

  async findEvent(eventId: string): Promise<GateEventRef | null> {
    const [event] = await db
      .select({ id: events.id, status: events.status, title: events.title })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);
    return event ?? null;
  }

  async gateBelongsToEvent(gateId: string, eventId: string) {
    const [gate] = await db
      .select({ id: gates.id })
      .from(gates)
      .where(and(eq(gates.id, gateId), eq(gates.eventId, eventId)))
      .limit(1);
    return Boolean(gate);
  }

  async checkInIfSold(
    ticketId: string,
    staffUserId: string,
    gateId: string | null,
    now: Date,
  ) {
    const [updated] = await db
      .update(tickets)
      .set(checkInValues(staffUserId, gateId, now))
      .where(
        and(eq(tickets.id, ticketId), eq(tickets.status, TicketStatus.SOLD)),
      )
      .returning();
    return updated ? toCheckedIn(updated) : null;
  }

  async findTicketState(ticketId: string): Promise<TicketStateRow | null> {
    const [row] = await db
      .select({
        id: tickets.id,
        status: tickets.status,
        checkedInAt: tickets.checkedInAt,
        checkedInBy: tickets.checkedInBy,
      })
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);
    return row ?? null;
  }

  async findScanDetails(ticketId: string): Promise<ScanTicketDetails | null> {
    const [row] = await db
      .select({
        ticketCode: tickets.ticketCode,
        ticketTypeName: ticketTypes.name,
        isSeated: ticketTypes.isSeated,
        zoneName: seats.zoneName,
        rowLabel: seats.rowLabel,
        seatNumber: seats.seatNumber,
        buyerName: users.fullName,
      })
      .from(tickets)
      .innerJoin(ticketTypes, eq(tickets.ticketTypeId, ticketTypes.id))
      .innerJoin(users, eq(tickets.userId, users.id))
      .leftJoin(seats, eq(tickets.seatId, seats.id))
      .where(eq(tickets.id, ticketId))
      .limit(1);
    return row ?? null;
  }

  async findLookupTicket(
    ticketCode: string,
    eventId: string,
  ): Promise<LookupTicketRow | null> {
    const [row] = await db
      .select({
        id: tickets.id,
        userId: tickets.userId,
        status: tickets.status,
        ticketCode: tickets.ticketCode,
        buyerPhone: users.phone,
        buyerEmail: users.email,
        buyerName: users.fullName,
        ticketTypeName: ticketTypes.name,
        isSeated: ticketTypes.isSeated,
        zoneName: seats.zoneName,
        rowLabel: seats.rowLabel,
        seatNumber: seats.seatNumber,
      })
      .from(tickets)
      .innerJoin(ticketTypes, eq(tickets.ticketTypeId, ticketTypes.id))
      .innerJoin(users, eq(tickets.userId, users.id))
      .leftJoin(seats, eq(tickets.seatId, seats.id))
      .where(
        and(eq(tickets.ticketCode, ticketCode), eq(tickets.eventId, eventId)),
      )
      .limit(1);
    return row ?? null;
  }

  checkInManually(input: {
    ticketId: string;
    staffUserId: string;
    staffRole: string;
    gateId: string | null;
    now: Date;
    audit: Record<string, unknown>;
  }): Promise<CheckedInTicket | null> {
    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(tickets)
        .set(checkInValues(input.staffUserId, input.gateId, input.now))
        .where(
          and(
            eq(tickets.id, input.ticketId),
            eq(tickets.status, TicketStatus.SOLD),
          ),
        )
        .returning();
      if (!updated) return null;

      // Ghi vet kiem toan bat buoc, cung transaction voi viec soat ve
      await tx.insert(auditLog).values({
        actorId: input.staffUserId,
        actorRole: input.staffRole,
        action: "MANUAL_TICKET_CHECK_IN",
        targetType: "TICKET",
        targetId: input.ticketId,
        changes: input.audit,
      });
      return toCheckedIn(updated);
    });
  }
}

export class DrizzleMyTicketsReader implements MyTicketsReader {
  async list(userId: string, query: MyTicketsQuery): Promise<MyTicketsPage> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const conditions = [eq(tickets.userId, userId)];
    if (query.eventId) conditions.push(eq(tickets.eventId, query.eventId));
    if (query.status) {
      conditions.push(eq(tickets.status, query.status));
    } else {
      conditions.push(
        inArray(tickets.status, [TicketStatus.SOLD, TicketStatus.CHECKED_IN]),
      );
    }
    const where = and(...conditions);

    const countResult = await db
      .select({ value: count() })
      .from(tickets)
      .where(where);
    const total = countResult[0]?.value ? Number(countResult[0].value) : 0;

    const rows = await db
      .select({
        ticketId: tickets.id,
        ticketCode: tickets.ticketCode,
        ticketStatus: tickets.status,
        checkedInAt: tickets.checkedInAt,
        orderId: orders.id,
        orderCode: orders.orderCode,
        orderTotalAmount: orders.totalAmount,
        orderFinalAmount: orders.finalAmount,
        eventId: events.id,
        eventTitle: events.title,
        eventBannerUrl: events.bannerUrl,
        eventStartTime: events.startTime,
        eventEndTime: events.endTime,
        eventVenueName: events.venueName,
        eventCity: events.city,
        eventStatus: events.status,
        ticketTypeId: ticketTypes.id,
        ticketTypeName: ticketTypes.name,
        ticketTypePrice: ticketTypes.price,
        isSeated: ticketTypes.isSeated,
        seatId: seats.id,
        seatZoneName: seats.zoneName,
        seatRowLabel: seats.rowLabel,
        seatNumber: seats.seatNumber,
      })
      .from(tickets)
      .innerJoin(events, eq(tickets.eventId, events.id))
      .innerJoin(orders, eq(tickets.orderId, orders.id))
      .innerJoin(ticketTypes, eq(tickets.ticketTypeId, ticketTypes.id))
      .leftJoin(seats, eq(tickets.seatId, seats.id))
      .where(where)
      .orderBy(asc(events.startTime), asc(tickets.id))
      .limit(limit)
      .offset((page - 1) * limit);

    return { total, rows };
  }
}
