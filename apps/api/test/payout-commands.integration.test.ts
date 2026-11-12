import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { EventStatus, PayoutStatus } from "@tickethub/shared";
import { createPayoutServices } from "../src/contexts/payout/payout.composition";
import { PayoutDomainError } from "../src/contexts/payout/domain/payout.errors";
import { db, sqlClient } from "../src/database/db";
import {
  auditLog,
  events,
  orders,
  payouts,
  refunds,
} from "../src/database/schema";

describe("Payout commands against the real database", () => {
  const { commands, queries } = createPayoutServices();
  const eventIds: string[] = [];
  const orderIds: string[] = [];
  let organizerId = "";
  let organizerUserId = "";
  let adminId = "";

  async function newEvent() {
    const start = new Date(Date.now() + 10 * 24 * 3600 * 1000);
    const [evt] = await db
      .insert(events)
      .values({
        organizerId,
        title: "Payout DB Test",
        slug: `payout-${randomUUID().slice(0, 8)}`,
        description: "d",
        category: "Am nhac",
        bannerUrl: "https://cdn.tickethub.vn/b.webp",
        venueName: "v",
        venueAddress: "a",
        city: "Ha Noi",
        startTime: start,
        endTime: new Date(start.getTime() + 3600_000),
        gateOpeningTime: start,
        status: EventStatus.PUBLISHED,
      })
      .returning();
    eventIds.push(evt!.id);
    return evt!.id;
  }

  async function paidOrder(eventId: string, amount: number, status = "PAID") {
    const [o] = await db
      .insert(orders)
      .values({
        orderCode: `PO${randomUUID().replace(/-/g, "").slice(0, 14)}`,
        userId: adminId,
        eventId,
        totalAmount: String(amount),
        finalAmount: String(amount),
        status: status as "PAID",
        expiresAt: new Date(Date.now() + 300_000),
      })
      .returning();
    orderIds.push(o!.id);
    return o!.id;
  }

  before(async () => {
    const profile = await db.query.organizerProfiles.findFirst();
    const user = await db.query.users.findFirst();
    assert.ok(profile && user, "seed data required");
    organizerId = profile.id;
    organizerUserId = profile.userId;
    adminId = user.id;
  });

  after(async () => {
    if (orderIds.length) {
      await db.delete(refunds).where(inArray(refunds.orderId, orderIds));
      await db.delete(orders).where(inArray(orders.id, orderIds));
    }
    if (eventIds.length) {
      const rows = await db
        .select({ id: payouts.id })
        .from(payouts)
        .where(inArray(payouts.eventId, eventIds));
      if (rows.length) {
        await db.delete(auditLog).where(
          inArray(
            auditLog.targetId,
            rows.map((r) => r.id),
          ),
        );
      }
      await db.delete(payouts).where(inArray(payouts.eventId, eventIds));
      await db.delete(events).where(inArray(events.id, eventIds));
    }
    await sqlClient.end();
  });

  it("generates a payout net of refunds, then updates the same row on regenerate", async () => {
    const eventId = await newEvent();
    const o1 = await paidOrder(eventId, 1_000_000);
    await paidOrder(eventId, 500_000, "REFUNDED");
    await db.insert(refunds).values({
      orderId: o1,
      amount: "200000",
      reason: "test",
      idempotencyKey: `payout-test-${randomUUID()}`,
    });

    const first = await commands.generatePayout(eventId, adminId);
    assert.equal(first.status, PayoutStatus.PENDING);
    assert.equal(first.totalRevenue, 1_500_000);
    assert.equal(first.refundDeduction, 200_000);
    // retained 1.3M: platform 5% = 65k; gateway 1.5% of gross 1.5M = 22.5k
    assert.equal(first.platformFee, 65_000);
    assert.equal(first.gatewayFee, 22_500);
    assert.equal(first.netPayout, 1_300_000 - 65_000 - 22_500);

    await paidOrder(eventId, 500_000);
    const second = await commands.generatePayout(eventId, adminId);
    assert.equal(second.id, first.id);
    assert.equal(second.totalRevenue, 2_000_000);
  });

  it("rejects unknown events and unknown payouts", async () => {
    await assert.rejects(
      () => commands.generatePayout(randomUUID(), adminId),
      (e: unknown) => e instanceof PayoutDomainError && e.kind === "NOT_FOUND",
    );
    await assert.rejects(
      () => commands.approvePayout(randomUUID(), adminId),
      (e: unknown) =>
        e instanceof PayoutDomainError &&
        e.message.startsWith("PAYOUT_NOT_FOUND"),
    );
  });

  it("holds, approves exactly once, writes audit logs and blocks later changes", async () => {
    const eventId = await newEvent();
    await paidOrder(eventId, 100_000);
    const payout = await commands.generatePayout(eventId, adminId);

    const held = await commands.holdPayout(
      payout.id,
      "Khieu nai",
      adminId,
      "1.2.3.4",
      "ua",
    );
    assert.equal(held.status, PayoutStatus.HOLD);
    assert.equal(held.holdReason, "Khieu nai");

    const approved = await commands.approvePayout(
      payout.id,
      adminId,
      "1.2.3.4",
      "ua",
    );
    assert.equal(approved.status, PayoutStatus.PAID_OUT);
    assert.equal(approved.approvedBy, adminId);
    assert.ok(approved.message);

    const logs = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.targetId, payout.id));
    assert.deepEqual(logs.map((l) => l.action).sort(), [
      "APPROVE_PAYOUT",
      "HOLD_PAYOUT",
    ]);
    assert.equal(logs[0]?.ipAddress, "1.2.3.4");

    const codeOf = async (work: Promise<unknown>) => {
      try {
        await work;
      } catch (e) {
        return e instanceof PayoutDomainError
          ? e.message.split(":")[0]
          : "OTHER";
      }
      return "NONE";
    };
    assert.equal(
      await codeOf(commands.approvePayout(payout.id, adminId)),
      "PAYOUT_ALREADY_APPROVED",
    );
    assert.equal(
      await codeOf(commands.holdPayout(payout.id, "x", adminId)),
      "CANNOT_HOLD_PAID_OUT",
    );
    assert.equal(
      await codeOf(commands.recalculatePayout(payout.id, adminId)),
      "PAYOUT_ALREADY_PAID_OUT",
    );
    assert.equal(
      await codeOf(commands.generatePayout(eventId, adminId)),
      "PAYOUT_ALREADY_PAID_OUT",
    );
  });

  it("lets only one of two concurrent approvals win", async () => {
    const eventId = await newEvent();
    await paidOrder(eventId, 100_000);
    const payout = await commands.generatePayout(eventId, adminId);

    const results = await Promise.allSettled([
      commands.approvePayout(payout.id, adminId),
      commands.approvePayout(payout.id, adminId),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const logs = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.targetId, payout.id));
    assert.equal(logs.length, 1);
  });

  it("lists payouts for admin and scopes the organizer list to their own profile", async () => {
    const eventId = await newEvent();
    await paidOrder(eventId, 100_000);
    const payout = await commands.generatePayout(eventId, adminId);

    const adminList = await queries.getAdminPayouts({
      eventId,
      page: 1,
      limit: 20,
    } as never);
    assert.equal(adminList.meta.total, 1);
    assert.equal(adminList.items[0]?.id, payout.id);

    const mine = await queries.getOrganizerPayouts(
      organizerUserId,
      {} as never,
    );
    assert.ok(mine.items.some((i) => i.id === payout.id));

    await assert.rejects(
      () => queries.getOrganizerPayouts(randomUUID(), {} as never),
      (e: unknown) =>
        e instanceof PayoutDomainError &&
        e.code === "ORGANIZER_PROFILE_REQUIRED" &&
        e.structured,
    );
  });
});
