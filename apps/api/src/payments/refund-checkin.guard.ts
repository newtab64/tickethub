import { ConflictException, NotFoundException } from "@nestjs/common";

import { and, eq, inArray, isNull, or } from "drizzle-orm";

import { OrderStatus, RefundStatus, TicketStatus } from "@tickethub/shared";

import { db } from "../database/db";
import { orders, refunds, tickets } from "../database/schema";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function lockTicketForCheckIn(
  tx: DbTransaction,
  ticketId: string,
) {
  // 1. Doc orderId cua ve, chua lock Ticket
  const [identity] = await tx
    .select({ orderId: tickets.orderId })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);

  if (!identity) {
    throw new NotFoundException("TICKET_NOT_FOUND");
  }

  // 2. Lock Order truoc
  const [order] = await tx
    .select()
    .from(orders)
    .where(eq(orders.id, identity.orderId))
    .limit(1)
    .for("update");

  if (!order || order.status !== OrderStatus.PAID) {
    throw new ConflictException("ORDER_NOT_PAID");
  }

  // 3. Lock Ticket sau Order
  const [ticket] = await tx
    .select()
    .from(tickets)
    .where(and(eq(tickets.id, ticketId), eq(tickets.orderId, order.id)))
    .limit(1)
    .for("update");

  if (!ticket) {
    throw new NotFoundException("TICKET_NOT_FOUND");
  }

  if (
    ticket.status !== TicketStatus.SOLD ||
    ticket.checkedInAt !== null ||
    ticket.eventId !== order.eventId
  ) {
    throw new ConflictException("TICKET_NOT_CHECKIN_ELIGIBLE");
  }

  // 4. Chan Refund toan Order hoac rieng Ticket
  const [activeRefund] = await tx
    .select({ id: refunds.id })
    .from(refunds)
    .where(
      and(
        eq(refunds.orderId, order.id),
        inArray(refunds.status, [
          RefundStatus.PENDING,
          RefundStatus.PROCESSING,
          RefundStatus.COMPLETED,
        ]),
        or(isNull(refunds.ticketId), eq(refunds.ticketId, ticket.id)),
      ),
    )
    .limit(1);

  if (activeRefund) {
    throw new ConflictException("TICKET_REFUND_ACTIVE");
  }

  return ticket;
}

interface CheckInTicketInput {
  ticketId: string;
  staffId: string;
  gateId: string;
}

export async function checkInTicket(input: CheckInTicketInput) {
  const { ticketId, staffId, gateId } = input;

  return db.transaction(async (tx) => {
    const ticket = await lockTicketForCheckIn(tx, ticketId);

    // TODO: Truoc doan nay, luong check-in thuc te phai
    // xac minh QR Token, nhan vien va cong hop le.

    const now = new Date();

    const [updated] = await tx
      .update(tickets)
      .set({
        status: TicketStatus.CHECKED_IN,
        checkedInAt: now,
        checkedInBy: staffId,
        gateId,
        updatedAt: now,
      })
      .where(
        and(
          eq(tickets.id, ticket.id),
          eq(tickets.status, TicketStatus.SOLD),
          isNull(tickets.checkedInAt),
        ),
      )
      .returning();

    if (!updated) {
      throw new ConflictException("TICKET_ALREADY_CHECKED_IN");
    }

    return updated;
  });
}
