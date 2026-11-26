import { and, count, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { PayoutStatus, UserRole } from "@tickethub/shared";
import { db } from "../../../database/db";
import { auditLog } from "../../../database/schema/audit-log";
import { events } from "../../../database/schema/events";
import { orders } from "../../../database/schema/orders";
import { organizerProfiles } from "../../../database/schema/organizer-profiles";
import { payouts } from "../../../database/schema/payouts";
import { refunds } from "../../../database/schema/refunds";
import type {
  AuditMeta,
  Paged,
  Payout,
  PayoutAmounts,
  PayoutEventRef,
  PayoutFilterQueryDto,
  PayoutListRow,
  PayoutTransitionResult,
} from "../domain/payout.models";
import type { PayoutQueryPort, PayoutRepository } from "../domain/payout.ports";

function toPayout(row: typeof payouts.$inferSelect): Payout {
  return {
    ...row,
    totalRevenue: Number(row.totalRevenue),
    platformFee: Number(row.platformFee),
    gatewayFee: Number(row.gatewayFee),
    refundDeduction: Number(row.refundDeduction),
    netPayout: Number(row.netPayout),
  };
}

function amountColumns(a: PayoutAmounts) {
  return {
    totalRevenue: String(a.grossRevenue),
    platformFee: String(a.platformFee),
    gatewayFee: String(a.gatewayFee),
    refundDeduction: String(a.refundDeduction),
    netPayout: String(a.netPayout),
  };
}

export class DrizzlePayoutRepository implements PayoutRepository {
  async findEvent(eventId: string): Promise<PayoutEventRef | null> {
    const [event] = await db
      .select({
        id: events.id,
        organizerId: events.organizerId,
        title: events.title,
      })
      .from(events)
      .where(eq(events.id, eventId));
    return event ?? null;
  }

  async findByEventId(eventId: string) {
    const [row] = await db
      .select()
      .from(payouts)
      .where(eq(payouts.eventId, eventId));
    return row ? toPayout(row) : null;
  }

  async findById(payoutId: string) {
    const [row] = await db
      .select()
      .from(payouts)
      .where(eq(payouts.id, payoutId));
    return row ? toPayout(row) : null;
  }

  async sumGrossRevenue(eventId: string) {
    const rows = await db
      .select({ finalAmount: orders.finalAmount })
      .from(orders)
      .where(
        and(
          eq(orders.eventId, eventId),
          inArray(orders.status, ["PAID", "REFUNDED"]),
        ),
      );
    return rows.reduce((sum, o) => sum + Number(o.finalAmount || 0), 0);
  }

  async sumRefundedAmount(eventId: string) {
    const rows = await db
      .select({ amount: refunds.amount })
      .from(refunds)
      .innerJoin(orders, eq(refunds.orderId, orders.id))
      .where(
        and(
          eq(orders.eventId, eventId),
          inArray(refunds.status, ["PENDING", "COMPLETED"]),
        ),
      );
    return rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  }

  async createPending(event: PayoutEventRef, amounts: PayoutAmounts) {
    const [created] = await db
      .insert(payouts)
      .values({
        organizerId: event.organizerId,
        eventId: event.id,
        ...amountColumns(amounts),
        status: PayoutStatus.PENDING,
      })
      .returning();
    return toPayout(created!);
  }

  async updateAmounts(payoutId: string, amounts: PayoutAmounts) {
    const [updated] = await db
      .update(payouts)
      .set({ ...amountColumns(amounts), updatedAt: new Date() })
      .where(eq(payouts.id, payoutId))
      .returning();
    return toPayout(updated!);
  }

  approve(
    payoutId: string,
    adminUserId: string,
    now: Date,
    meta: AuditMeta,
  ): Promise<PayoutTransitionResult> {
    return this.transition(
      payoutId,
      {
        status: PayoutStatus.PAID_OUT,
        approvedBy: adminUserId,
        paidOutAt: now,
        updatedAt: now,
      },
      {
        action: "APPROVE_PAYOUT",
        changes: {
          newStatus: PayoutStatus.PAID_OUT,
          approvedBy: adminUserId,
          paidOutAt: now.toISOString(),
        },
      },
      adminUserId,
      meta,
    );
  }

  hold(
    payoutId: string,
    reason: string,
    adminUserId: string,
    now: Date,
    meta: AuditMeta,
  ): Promise<PayoutTransitionResult> {
    return this.transition(
      payoutId,
      { status: PayoutStatus.HOLD, holdReason: reason, updatedAt: now },
      {
        action: "HOLD_PAYOUT",
        changes: { newStatus: PayoutStatus.HOLD, holdReason: reason },
      },
      adminUserId,
      meta,
    );
  }

  /** Cap nhat nguyen tu: chi khi chua PAID_OUT, cung transaction voi audit log. */
  private transition(
    payoutId: string,
    set: Partial<typeof payouts.$inferInsert>,
    audit: { action: string; changes: Record<string, unknown> },
    adminUserId: string,
    meta: AuditMeta,
  ): Promise<PayoutTransitionResult> {
    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(payouts)
        .set(set)
        .where(
          and(
            eq(payouts.id, payoutId),
            ne(payouts.status, PayoutStatus.PAID_OUT),
          ),
        )
        .returning();

      if (!updated) {
        const [existing] = await tx
          .select({ status: payouts.status })
          .from(payouts)
          .where(eq(payouts.id, payoutId));
        return existing
          ? { outcome: "ALREADY_PAID_OUT" as const }
          : { outcome: "NOT_FOUND" as const };
      }

      await tx.insert(auditLog).values({
        actorId: adminUserId,
        actorRole: UserRole.ADMIN,
        action: audit.action,
        targetType: "PAYOUT",
        targetId: payoutId,
        changes: audit.changes,
        ipAddress: meta.ipAddress ?? null,
        userAgent: meta.userAgent ?? null,
      });

      return { outcome: "UPDATED" as const, payout: toPayout(updated) };
    });
  }
}

const money = (col: AnyPgColumn) => sql<number>`CAST(${col} AS FLOAT)`;

export class DrizzlePayoutQuery implements PayoutQueryPort {
  async findOrganizerProfileId(userId: string) {
    const profile = await db.query.organizerProfiles.findFirst({
      where: eq(organizerProfiles.userId, userId),
    });
    return profile?.id ?? null;
  }

  async listForAdmin(
    query: PayoutFilterQueryDto,
    page: number,
    limit: number,
  ): Promise<Paged<PayoutListRow>> {
    const conditions = [];
    if (query.status) conditions.push(eq(payouts.status, query.status));
    if (query.organizerId) {
      conditions.push(eq(payouts.organizerId, query.organizerId));
    }
    if (query.eventId) conditions.push(eq(payouts.eventId, query.eventId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow] = await db
      .select({ count: count() })
      .from(payouts)
      .where(where);
    const total = totalRow?.count ?? 0;

    const rows = await db
      .select({
        id: payouts.id,
        organizerId: payouts.organizerId,
        eventId: payouts.eventId,
        eventTitle: events.title,
        organizationName: organizerProfiles.organizationName,
        totalRevenue: money(payouts.totalRevenue),
        platformFee: money(payouts.platformFee),
        gatewayFee: money(payouts.gatewayFee),
        refundDeduction: money(payouts.refundDeduction),
        netPayout: money(payouts.netPayout),
        status: payouts.status,
        holdReason: payouts.holdReason,
        paidOutAt: payouts.paidOutAt,
        approvedBy: payouts.approvedBy,
        createdAt: payouts.createdAt,
        updatedAt: payouts.updatedAt,
      })
      .from(payouts)
      .innerJoin(events, eq(payouts.eventId, events.id))
      .innerJoin(
        organizerProfiles,
        eq(payouts.organizerId, organizerProfiles.id),
      )
      .where(where)
      .orderBy(desc(payouts.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      items: rows,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async listForOrganizer(
    profileId: string,
    page: number,
    limit: number,
  ): Promise<Paged<PayoutListRow>> {
    const where = eq(payouts.organizerId, profileId);

    const [totalRow] = await db
      .select({ count: count() })
      .from(payouts)
      .where(where);
    const total = totalRow?.count ?? 0;

    const rows = await db
      .select({
        id: payouts.id,
        eventId: payouts.eventId,
        eventTitle: events.title,
        totalRevenue: money(payouts.totalRevenue),
        platformFee: money(payouts.platformFee),
        gatewayFee: money(payouts.gatewayFee),
        refundDeduction: money(payouts.refundDeduction),
        netPayout: money(payouts.netPayout),
        status: payouts.status,
        paidOutAt: payouts.paidOutAt,
        createdAt: payouts.createdAt,
      })
      .from(payouts)
      .innerJoin(events, eq(payouts.eventId, events.id))
      .where(where)
      .orderBy(desc(payouts.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      items: rows,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }
}
