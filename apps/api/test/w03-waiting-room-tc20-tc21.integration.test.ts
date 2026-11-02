import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import { JwtService } from "@nestjs/jwt";
import { eq, inArray } from "drizzle-orm";

import { env } from "../src/config/env.config";
import { db, sqlClient } from "../src/database/db";
import {
  events,
  orders,
  orderItems,
  organizerProfiles,
  ticketTypes,
  users,
} from "../src/database/schema";
import { WaitingRoomService } from "../src/waiting-room/waiting-room.service";
import { WaitingRoomMaintenanceTask } from "../src/waiting-room/waiting-room-maintenance.task";
import {
  EventStatus,
  OrderStatus,
  OrganizerStatus,
  RefundPolicyType,
  UserRole,
  UserStatus,
} from "@tickethub/shared";

// Safety gate: this test creates/deletes data and removes Redis test keys.
const databaseName = decodeURIComponent(
  new URL(env.DATABASE_URL).pathname.slice(1),
);
const redisUrl = new URL(env.REDIS_URL);
const redisDb = redisUrl.pathname || "/0";
if (
  env.NODE_ENV !== "test" ||
  !["tickethub_w03_test", "tickethub_w04_test"].includes(databaseName) ||
  redisDb !== "/15" ||
  !["localhost", "127.0.0.1"].includes(redisUrl.hostname)
) {
  throw new Error(
    "TC20/21 tests require NODE_ENV=test, isolated test DB and local Redis DB /15",
  );
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("UC03 TC20/TC21 Waiting Room integration", () => {
  let redis: Redis;
  let service: WaitingRoomService;
  let eventId = "";
  let organizerId = "";
  let ticketTypeId = "";
  let buyers: string[] = [];
  let createdUserIds: string[] = [];
  let pendingBuyer1 = "";
  let pendingBuyer2 = "";
  const stamp = randomUUID().slice(0, 12);

  const queueKey = () => `waiting_room:${eventId}`;
  const activeKey = () => `active_users:${eventId}`;
  const hb = (userId: string) => `w03:waiting-room:hb:${eventId}:${userId}`;

  before(async () => {
    redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1 });
    service = new WaitingRoomService(
      redis,
      new JwtService({ secret: env.JWT_SECRET }),
    );
    const [orgUser, ...buyerUsers] = await db
      .insert(users)
      .values(
        ["organizer", "buyer1", "buyer2", "buyer3"].map((name, i) => ({
          email: `tc20-${stamp}-${name}@example.test`,
          fullName: `TC20 ${name}`,
          passwordHash: "$argon2id$v=19$dummyhash",
          role: i === 0 ? UserRole.ORGANIZER : UserRole.BUYER,
          status: UserStatus.ACTIVE,
        })),
      )
      .returning();
    createdUserIds = [orgUser!, ...buyerUsers].map((u) => u!.id);
    buyers = buyerUsers.map((u) => u!.id);
    const [org] = await db
      .insert(organizerProfiles)
      .values({
        userId: orgUser!.id,
        organizationName: `TC20 Organization ${stamp}`,
        taxCode: `TC20-${stamp}`,
        businessLicenseUrl: "https://example.test/license",
        representativeName: "TC20 Tester",
        status: OrganizerStatus.VERIFIED,
      })
      .returning();
    organizerId = org!.id;

    const now = new Date();
    const start = new Date(now.getTime() + 24 * 3600_000);
    const [event] = await db
      .insert(events)
      .values({
        organizerId,
        title: "TC20 TC21 Waiting Room",
        slug: `tc20-${stamp}`,
        description: "isolated integration test",
        category: "Music",
        bannerUrl: "https://example.test/banner",
        venueName: "Test venue",
        venueAddress: "Test address",
        city: "HCMC",
        startTime: start,
        endTime: new Date(start.getTime() + 2 * 3600_000),
        gateOpeningTime: start,
        status: EventStatus.PUBLISHED,
        isWaitingRoomEnabled: true,
        maxActiveUsers: 1,
        refundPolicyType: RefundPolicyType.FLEXIBLE,
      })
      .returning();
    eventId = event!.id;

    const [tt] = await db
      .insert(ticketTypes)
      .values({
        eventId,
        name: "Standing",
        price: "100000.00",
        capacity: 5,
        soldCount: 0,
        heldCount: 0,
        isSeated: false,
        saleStartTime: new Date(now.getTime() - 60_000),
        saleEndTime: start,
      })
      .returning();
    ticketTypeId = tt!.id;
  });

  after(async () => {
    try {
      if (redis && eventId) {
        await redis.unlink(queueKey(), activeKey());
        const keys = await redis.keys(`w03:waiting-room:hb:${eventId}:*`);
        if (keys.length) await redis.unlink(...keys);
        await redis.srem("w03:waiting-room:events", eventId);
      }
      if (eventId) {
        const orderIds = await db
          .select({ id: orders.id })
          .from(orders)
          .where(eq(orders.eventId, eventId));
        if (orderIds.length) {
          await db.delete(orderItems).where(
            inArray(
              orderItems.orderId,
              orderIds.map((o) => o.id),
            ),
          );
          await db.delete(orders).where(
            inArray(
              orders.id,
              orderIds.map((o) => o.id),
            ),
          );
        }
        await db.delete(ticketTypes).where(eq(ticketTypes.eventId, eventId));
        await db.delete(events).where(eq(events.id, eventId));
      }
      if (organizerId)
        await db
          .delete(organizerProfiles)
          .where(eq(organizerProfiles.id, organizerId));
      if (createdUserIds.length)
        await db.delete(users).where(inArray(users.id, createdUserIds));
    } finally {
      if (redis) redis.disconnect();
      await sqlClient.end();
    }
  });

  it("TC20: disabling Waiting Room is cleaned by the 5-second maintenance without API traffic", async () => {
    const [first, second] = buyers;
    assert.ok(first && second);
    await redis.sadd(activeKey(), first);
    await redis.zadd(queueKey(), Date.now(), second);
    await redis.set(hb(first), "1", "EX", 60);
    await redis.set(hb(second), "1", "EX", 60);
    await redis.sadd("w03:waiting-room:events", eventId);
    await db
      .update(events)
      .set({ isWaitingRoomEnabled: false })
      .where(eq(events.id, eventId));

    const maintenance = new WaitingRoomMaintenanceTask(redis);
    maintenance.onModuleInit();
    try {
      let cleared = false;
      for (let i = 0; i < 32; i++) {
        await delay(250);
        const [rank, active, firstHb, secondHb, inList] = await Promise.all([
          redis.zrank(queueKey(), second),
          redis.sismember(activeKey(), first),
          redis.exists(hb(first)),
          redis.exists(hb(second)),
          redis.sismember("w03:waiting-room:events", eventId),
        ]);
        if (
          rank === null &&
          active === 0 &&
          firstHb === 0 &&
          secondHb === 0 &&
          inList === 0
        ) {
          cleared = true;
          break;
        }
      }
      assert.equal(
        cleared,
        true,
        "waiting-room state must be cleaned within 8 seconds",
      );
    } finally {
      maintenance.onModuleDestroy();
    }
    const resumed = await service.heartbeat(second, eventId);
    assert.equal(resumed.status, "ADMITTED");
    assert.equal(await redis.zrank(queueKey(), second), null);
  });

  it("TC20: join and heartbeat also purge stale state immediately after disable", async () => {
    const [first, second] = buyers;
    assert.ok(first && second);
    await redis.zadd(queueKey(), Date.now(), second);
    await redis.sadd(activeKey(), first);
    await redis.set(hb(first), "1", "EX", 60);
    await redis.set(hb(second), "1", "EX", 60);
    await redis.sadd("w03:waiting-room:events", eventId);
    assert.equal((await service.joinQueue(second, eventId)).status, "ADMITTED");
    assert.equal(await redis.zrank(queueKey(), second), null);
    assert.equal(await redis.scard(activeKey()), 0);
    assert.equal(await redis.exists(hb(second)), 0);
  });

  it("TC21: join/heartbeat resume the buyer's own live PENDING order and release queued rank", async () => {
    const [first, second, third] = buyers;
    assert.ok(first && second && third);
    await db
      .update(events)
      .set({ isWaitingRoomEnabled: true })
      .where(eq(events.id, eventId));
    await redis.sadd(activeKey(), first);
    await redis.zadd(queueKey(), Date.now(), second);
    await redis.set(hb(first), "1", "EX", 60);
    await redis.set(hb(second), "1", "EX", 60);
    await redis.sadd("w03:waiting-room:events", eventId);

    const [order] = await db
      .insert(orders)
      .values({
        orderCode: `TC21-${stamp}-B2`,
        userId: second,
        eventId,
        totalAmount: "100000.00",
        finalAmount: "100000.00",
        status: OrderStatus.PENDING,
        expiresAt: new Date(Date.now() + 5 * 60_000),
      })
      .returning();
    pendingBuyer2 = order!.id;

    const joined = await service.joinQueue(second, eventId);
    assert.equal(joined.status, "PENDING_ORDER");
    assert.equal(joined.orderId, pendingBuyer2);
    assert.ok(joined.expiresAt);
    assert.equal(await redis.zrank(queueKey(), second), null);
    assert.equal(await redis.sismember(activeKey(), first), 1);
    const heartbeated = await service.heartbeat(second, eventId);
    assert.equal(heartbeated.status, "PENDING_ORDER");
    assert.equal(heartbeated.orderId, pendingBuyer2);
    const otherBuyer = await service.joinQueue(third, eventId);
    assert.equal(otherBuyer.status, "QUEUED");
    assert.equal(otherBuyer.orderId, undefined);
  });

  it("TC21: active buyer with a live hold keeps their active slot", async () => {
    const first = buyers[0]!;
    const [order] = await db
      .insert(orders)
      .values({
        orderCode: `TC21-${stamp}-B1`,
        userId: first,
        eventId,
        totalAmount: "100000.00",
        finalAmount: "100000.00",
        status: OrderStatus.PENDING,
        expiresAt: new Date(Date.now() + 5 * 60_000),
      })
      .returning();
    pendingBuyer1 = order!.id;
    const result = await service.joinQueue(first, eventId);
    assert.equal(result.status, "PENDING_ORDER");
    assert.equal(result.orderId, pendingBuyer1);
    assert.equal(await redis.sismember(activeKey(), first), 1);

    await redis.del(hb(first));
    // Heartbeat expired, but the active slot remains held by the pending order.
    const maintenance = new WaitingRoomMaintenanceTask(redis);
    await (
      maintenance as unknown as {
        maintainEvent(eventId: string): Promise<void>;
      }
    ).maintainEvent(eventId);
    assert.equal(await redis.sismember(activeKey(), first), 1);
  });

  it("TC21: expired PENDING order is NOT resumed", async () => {
    const second = buyers[1]!;
    await db
      .update(orders)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(orders.id, pendingBuyer2));
    const result = await service.joinQueue(second, eventId);
    assert.notEqual(result.status, "PENDING_ORDER");
    assert.equal(result.orderId, undefined);
  });

  it("TC19 + TC21: a valid held order takes precedence over SOLD_OUT, other buyers see SOLD_OUT", async () => {
    await db
      .update(ticketTypes)
      .set({ soldCount: 5 })
      .where(eq(ticketTypes.id, ticketTypeId));
    const first = buyers[0]!;
    const third = buyers[2]!;
    const pending = await service.joinQueue(first, eventId);
    assert.equal(pending.status, "PENDING_ORDER");
    assert.equal(pending.orderId, pendingBuyer1);
    const soldOut = await service.joinQueue(third, eventId);
    assert.equal(soldOut.status, "SOLD_OUT");
  });
});
