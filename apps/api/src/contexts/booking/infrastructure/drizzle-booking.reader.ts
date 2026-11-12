import { and, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../../database/db";
import { events, orders, ticketTypes } from "../../../database/schema";
import type {
  BookingEventRef,
  BookingOrderView,
  BookingTicketType,
  PendingOrderForRelease,
} from "../domain/booking.models";
import type {
  OrderDetailRecord,
  OrderListPage,
} from "../domain/buyer-order.models";
import type { BookingReader } from "../domain/booking.ports";
import type { BuyerOrderReader } from "../domain/buyer-order.ports";

export class DrizzleBookingReader implements BookingReader {
  async findEvent(eventId: string): Promise<BookingEventRef | null> {
    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
    });
    return event ? { id: event.id, status: event.status } : null;
  }

  async findTicketTypes(
    eventId: string,
    ticketTypeIds: string[],
  ): Promise<BookingTicketType[]> {
    const rows = await db.query.ticketTypes.findMany({
      where: and(
        inArray(ticketTypes.id, ticketTypeIds),
        eq(ticketTypes.eventId, eventId),
      ),
    });
    return rows.map((tt) => ({
      id: tt.id,
      price: tt.price,
      isSeated: tt.isSeated,
    }));
  }

  async findPendingOrderForRelease(
    orderId: string,
    userId: string,
  ): Promise<PendingOrderForRelease | null> {
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.userId, userId)),
      with: { items: true },
    });
    if (!order) return null;
    return {
      id: order.id,
      eventId: order.eventId,
      status: order.status,
      items: order.items.map((i) => ({
        seatId: i.seatId,
        ticketTypeId: i.ticketTypeId,
        quantity: i.quantity,
      })),
    };
  }

  async findOwnedOrderDetail(
    orderId: string,
    userId: string,
  ): Promise<BookingOrderView | null> {
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.userId, userId)),
      with: {
        items: { with: { ticketType: true, seat: true } },
        event: true,
      },
    });
    return order ?? null;
  }
}

export class DrizzleBuyerOrderReader implements BuyerOrderReader {
  async listByUser(
    userId: string,
    status: string | undefined,
    page: number,
    limit: number,
  ): Promise<OrderListPage> {
    const conditions = [eq(orders.userId, userId)];
    if (status) conditions.push(eq(orders.status, status as "PAID"));
    const where = and(...conditions);

    const countResult = await db
      .select({ value: count() })
      .from(orders)
      .where(where);
    const total = countResult[0]?.value ? Number(countResult[0].value) : 0;

    const rows = await db.query.orders.findMany({
      where,
      orderBy: [desc(orders.createdAt)],
      limit,
      offset: (page - 1) * limit,
      with: { event: true, items: true },
    });
    return { total, orders: rows };
  }

  async findDetail(orderId: string): Promise<OrderDetailRecord | null> {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        event: true,
        items: { with: { ticketType: true } },
        tickets: { with: { ticketType: true, seat: true } },
        refunds: true,
      },
    });
    return order ?? null;
  }
}
