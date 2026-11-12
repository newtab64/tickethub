import { errorCodeOf } from "./helpers/http-error";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { asc, eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import { createBookingCommands } from "../src/contexts/booking/booking.composition";
import { db, sqlClient } from "../src/database/db";
import { env } from "../src/config/env.config";
import type { EventReadModel } from "../src/contexts/event/application/event-read-model";
import {
  users,
  events,
  ticketTypes,
  seats,
  orders,
  orderItems,
  organizerProfiles,
} from "../src/database/schema";
import {
  UserRole,
  UserStatus,
  EventStatus,
  RefundPolicyType,
  SeatStatus,
} from "@tickethub/shared";

const cacheStub = {
  invalidate: async (_eventId: string): Promise<void> => {},
} as EventReadModel;

const SEATS_PER_ROW = 10;
const ROWS = 15;
const BUYER_COUNT = 140;
const COLLIDING_SEATS = 10;

function seatNumber(index: number): string {
  return String((index % SEATS_PER_ROW) + 1).padStart(2, "0");
}

function rowLabel(index: number): string {
  return String.fromCharCode(65 + Math.floor(index / SEATS_PER_ROW));
}

describe("Auto Seat Allocation: dong thoi nhieu nguoi mua cung mot hang ve", () => {
  const bookingService = createBookingCommands(cacheStub);

  let buyerIds: string[] = [];
  let eventId = "";
  let singleTicketTypeId = "";
  let pairTicketTypeId = "";
  let lastSeatTicketTypeId = "";
  let lockTicketTypeId = "";

  async function createSeatedTicketType(
    name: string,
    zoneName: string,
    seatCount: number,
    now: Date,
    saleEnd: Date,
  ): Promise<string> {
    const [tt] = await db
      .insert(ticketTypes)
      .values({
        eventId,
        name,
        price: "500000.00",
        capacity: seatCount,
        isSeated: true,
        saleStartTime: now,
        saleEndTime: saleEnd,
      })
      .returning();

    await db.insert(seats).values(
      Array.from({ length: seatCount }, (_, index) => ({
        eventId,
        ticketTypeId: tt!.id,
        zoneName,
        rowLabel: rowLabel(index),
        seatNumber: seatNumber(index),
        status: SeatStatus.AVAILABLE,
      })),
    );
    return tt!.id;
  }

  before(async () => {
    let orgProfile = await db.query.organizerProfiles.findFirst();
    if (!orgProfile) {
      const [u] = await db
        .insert(users)
        .values({
          email: `org_seat_conc_${Date.now()}@tickethub.vn`,
          fullName: "Ban To Chuc Seat Concurrency",
          passwordHash: "$argon2id$v=19$dummyhash",
          role: UserRole.ORGANIZER,
          status: UserStatus.ACTIVE,
        })
        .returning();
      const [profile] = await db
        .insert(organizerProfiles)
        .values({
          userId: u!.id,
          organizationName: "Cong ty Seat Concurrency Test",
          taxCode: "0109999999",
          businessLicenseUrl: "https://cdn.tickethub.vn/license.pdf",
          representativeName: "Giam Doc Seat Concurrency",
        })
        .returning();
      orgProfile = profile;
    }

    const stamp = Date.now();
    const createdUsers = await db
      .insert(users)
      .values(
        Array.from({ length: BUYER_COUNT }, (_, idx) => ({
          email: `buyer_seat_conc_${idx}_${stamp}@tickethub.vn`,
          fullName: `Nguoi Mua Concurrency ${idx + 1}`,
          passwordHash: "$argon2id$dummy",
          role: UserRole.BUYER,
          status: UserStatus.ACTIVE,
        })),
      )
      .returning();
    buyerIds = createdUsers.map((u) => u.id);

    const now = new Date();
    const startTime = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    const endTime = new Date(startTime.getTime() + 4 * 3600 * 1000);

    const [evt] = await db
      .insert(events)
      .values({
        organizerId: orgProfile!.id,
        title: "Su Kien Thu Nghiem Dong Thoi Cap Ghe Tu Dong",
        slug: `seat-concurrency-evt-${stamp}`,
        description: "Nhieu nguoi mua dong thoi trong cung mot hang ve",
        category: "Am nhac",
        bannerUrl: "https://cdn.tickethub.vn/banner.webp",
        venueName: "San van dong Test",
        venueAddress: "123 Duong Test, Quan 1",
        city: "TP. Ho Chi Minh",
        startTime,
        endTime,
        gateOpeningTime: startTime,
        status: EventStatus.PUBLISHED,
        refundPolicyType: RefundPolicyType.FLEXIBLE,
      })
      .returning();
    eventId = evt!.id;

    singleTicketTypeId = await createSeatedTicketType(
      "Hang Ve Don Dong Thoi",
      "Khu Don",
      SEATS_PER_ROW * ROWS,
      now,
      startTime,
    );
    pairTicketTypeId = await createSeatedTicketType(
      "Hang Ve Doi Dong Thoi",
      "Khu Doi",
      SEATS_PER_ROW * ROWS,
      now,
      startTime,
    );
    lastSeatTicketTypeId = await createSeatedTicketType(
      "Hang Ve Ghe Cuoi",
      "Khu Ghe Cuoi",
      1,
      now,
      startTime,
    );
    lockTicketTypeId = await createSeatedTicketType(
      "Hang Ve Va Cham Khoa",
      "Khu Va Cham",
      SEATS_PER_ROW * ROWS,
      now,
      startTime,
    );
  });

  after(async () => {
    if (eventId) {
      await db
        .update(seats)
        .set({ holdOrderId: null })
        .where(eq(seats.eventId, eventId));

      const orderRows = await db
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.eventId, eventId));
      if (orderRows.length > 0) {
        const orderIds = orderRows.map((o) => o.id);
        await db
          .delete(orderItems)
          .where(inArray(orderItems.orderId, orderIds));
        await db.delete(orders).where(inArray(orders.id, orderIds));
      }

      await db.delete(seats).where(eq(seats.eventId, eventId));
      await db.delete(ticketTypes).where(eq(ticketTypes.eventId, eventId));
      await db.delete(events).where(eq(events.id, eventId));
    }

    if (buyerIds.length > 0) {
      await db.delete(users).where(inArray(users.id, buyerIds));
    }

    await sqlClient.end();
  });

  it("0. Khong bi tu choi khi cac ghe dau tien dang duoc nhieu giao dich khac giu lien tiep", async () => {
    // Mo phong nguoi mua khac: moi ghe trong COLLIDING_SEATS ghe dau duoc mot
    // giao dich rieng khoa (FOR UPDATE) va chi nha khi da danh dau HELD.
    const firstSeats = await db
      .select({ id: seats.id })
      .from(seats)
      .where(eq(seats.ticketTypeId, lockTicketTypeId))
      .orderBy(asc(seats.rowLabel), asc(seats.seatNumber))
      .limit(COLLIDING_SEATS);
    assert.equal(firstSeats.length, COLLIDING_SEATS);
    const blockedIds = firstSeats.map((s) => s.id);

    const blockerSql = postgres(env.DATABASE_URL, {
      max: COLLIDING_SEATS + 2,
    });
    const blockers = blockedIds.map((seatId) => {
      let acquire!: () => void;
      const acquired = new Promise<void>((resolve) => (acquire = resolve));
      let release!: () => void;
      const released = new Promise<void>((resolve) => (release = resolve));
      const done = blockerSql.begin(async (tx) => {
        await tx`SELECT id FROM seats WHERE id = ${seatId} FOR UPDATE`;
        acquire();
        await released;
        await tx`UPDATE seats SET status = 'HELD', hold_expires_at = now() + interval '5 minutes' WHERE id = ${seatId}`;
      });
      return { acquired, release, done };
    });

    try {
      await Promise.all(blockers.map((b) => b.acquired));

      let settled = false;
      const request = bookingService
        .holdSeats(buyerIds[0]!, {
          eventId,
          items: [{ ticketTypeId: lockTicketTypeId, quantity: 1 }],
        })
        .then(
          (value) => ({ ok: true as const, value }),
          (reason: unknown) => ({ ok: false as const, reason }),
        )
        .finally(() => {
          settled = true;
        });

      // Moi lan yeu cau bi chan cho mot ghe, nha ghe do (ghe chuyen sang HELD)
      // de yeu cau phai chon lai. Neu yeu cau da xong thi khong can nha them.
      for (const blocker of blockers) {
        const deadline = Date.now() + 5000;
        while (!settled && Date.now() < deadline) {
          const [row] = await blockerSql<{ waiting: number }[]>`
            SELECT count(*)::int AS waiting FROM pg_stat_activity
            WHERE datname = current_database()
              AND wait_event_type = 'Lock' AND state = 'active'`;
          if ((row?.waiting ?? 0) > 0) break;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        if (settled) break;
        blocker.release();
        await blocker.done;
      }

      const outcome = await request;
      assert.equal(
        outcome.ok,
        true,
        `Con ${SEATS_PER_ROW * ROWS - COLLIDING_SEATS} ghe trong, khong duoc tu choi. Ma loi: ${
          outcome.ok
            ? ""
            : (errorCodeOf(outcome.reason) ?? String(outcome.reason))
        }`,
      );
      if (outcome.ok) {
        const seatId = outcome.value.allocatedSeats[0]!.id;
        assert.ok(
          !blockedIds.includes(seatId),
          "Ghe duoc cap phai la ghe khac cac ghe dang bi giu",
        );
      }
    } finally {
      for (const blocker of blockers) blocker.release();
      await Promise.allSettled(blockers.map((b) => b.done));
      await blockerSql.end();
    }
  });

  it("1. 140 nguoi giu 1 ve dong thoi trong vung 150 ghe: khong ai bi tu choi, 0 ghe trung", async () => {
    const results = await Promise.allSettled(
      buyerIds.map((buyerId) =>
        bookingService.holdSeats(buyerId, {
          eventId,
          items: [{ ticketTypeId: singleTicketTypeId, quantity: 1 }],
        }),
      ),
    );

    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(
      rejected.length,
      0,
      `Vung con ${SEATS_PER_ROW * ROWS - BUYER_COUNT} ghe trong sau khi giu xong, khong duoc tu choi ai. Ma loi: ${rejected
        .map(
          (r) =>
            errorCodeOf((r as PromiseRejectedResult).reason) ??
            String((r as PromiseRejectedResult).reason),
        )
        .join(", ")}`,
    );

    const seatIds = results.flatMap((r) =>
      r.status === "fulfilled" ? r.value.allocatedSeats.map((s) => s.id) : [],
    );
    assert.equal(seatIds.length, BUYER_COUNT);
    assert.equal(new Set(seatIds).size, BUYER_COUNT, "Ghe khong duoc trung");

    const held = await db.query.seats.findMany({
      where: eq(seats.ticketTypeId, singleTicketTypeId),
    });
    assert.equal(
      held.filter((s) => s.status === SeatStatus.HELD).length,
      BUYER_COUNT,
    );
  });

  it("2. 30 nguoi giu 2 ve dong thoi: khong ai bi tu choi, moi cap ghe lien ke trong cung hang", async () => {
    const buyers = buyerIds.slice(0, 30);
    const results = await Promise.allSettled(
      buyers.map((buyerId) =>
        bookingService.holdSeats(buyerId, {
          eventId,
          items: [{ ticketTypeId: pairTicketTypeId, quantity: 2 }],
        }),
      ),
    );

    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(rejected.length, 0, "Khong ai duoc bi tu choi khi con du ghe");

    const allIds: string[] = [];
    for (const r of results) {
      assert.equal(r.status, "fulfilled");
      if (r.status !== "fulfilled") continue;
      assert.equal(r.value.allocatedSeats.length, 2);
      const [a, b] = r.value.allocatedSeats;
      assert.equal(a!.rowLabel, b!.rowLabel, "Hai ghe phai cung hang");
      assert.equal(
        Math.abs(Number(a!.seatNumber) - Number(b!.seatNumber)),
        1,
        "Hai ghe phai lien ke",
      );
      allIds.push(a!.id, b!.id);
    }
    assert.equal(new Set(allIds).size, 60, "Ghe khong duoc trung");
  });

  it("3. 60 nguoi tranh nhau ghe cuoi cung: dung 1 nguoi thang, con lai nhan INSUFFICIENT_TICKET_CAPACITY", async () => {
    const results = await Promise.allSettled(
      buyerIds.slice(0, 60).map((buyerId) =>
        bookingService.holdSeats(buyerId, {
          eventId,
          items: [{ ticketTypeId: lastSeatTicketTypeId, quantity: 1 }],
        }),
      ),
    );

    const winners = results.filter((r) => r.status === "fulfilled");
    assert.equal(winners.length, 1, "Chi co dung 1 nguoi duoc giu ghe cuoi");

    const losers = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );
    assert.equal(losers.length, 59);
    for (const loser of losers) {
      assert.equal(errorCodeOf(loser.reason), "INSUFFICIENT_TICKET_CAPACITY");
    }
  });
});
