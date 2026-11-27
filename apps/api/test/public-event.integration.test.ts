import "reflect-metadata";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { eq, inArray } from "drizzle-orm";
import type Redis from "ioredis";
import { EventStatus, PublicEventSchema, SeatStatus } from "@tickethub/shared";

import { AppModule } from "../src/app.module";
import { BookingCommands } from "../src/contexts/booking/application/booking-commands.service";
import { BookingDomainError } from "../src/contexts/booking/domain/booking.errors";
import { db } from "../src/database/db";
import { REDIS_CLIENT } from "../src/database/redis.module";
import {
  events,
  organizerProfiles,
  seats,
  ticketTypes,
  users,
} from "../src/database/schema";

describe("Public event lookup (HTTP)", () => {
  let app: NestFastifyApplication;
  let base = "";
  let userId = "";
  const eventIds: string[] = [];
  const stamp = Date.now();
  let published = { id: "", slug: `public-${stamp}` };
  let draft = { id: "", slug: `draft-${stamp}` };

  async function insertEvent(
    organizerId: string,
    slug: string,
    status: EventStatus,
  ) {
    const [row] = await db
      .insert(events)
      .values({
        organizerId,
        title: `Su kien ${slug}`,
        slug,
        description: "Su kien kiem thu tra cuu cong khai",
        category: "Âm nhạc",
        bannerUrl: "/images/events/vn/anh-trai.jpg",
        venueName: "Nha hat",
        venueAddress: "1 Trang Tien",
        city: "Hà Nội",
        status,
        mapKey: "arena-t-stage",
        startTime: new Date("2027-01-01T12:00:00.000Z"),
        endTime: new Date("2027-01-01T15:00:00.000Z"),
        gateOpeningTime: new Date("2027-01-01T11:00:00.000Z"),
      })
      .returning();
    eventIds.push(row!.id);
    return { id: row!.id, slug };
  }

  const get = async (identifier: string) => {
    const res = await fetch(`${base}/events/${identifier}`);
    return { status: res.status, body: await res.json() };
  };

  before(async () => {
    app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter(),
      { logger: false },
    );
    await app.listen(0, "127.0.0.1");
    base = `${await app.getUrl()}/api/v1`;

    const [user] = await db
      .insert(users)
      .values({
        email: `public-event-${stamp}@tickethub.vn`,
        fullName: "Ban to chuc",
        passwordHash: "test-hash",
        role: "ORGANIZER",
        status: "ACTIVE",
      })
      .returning();
    userId = user!.id;
    const [profile] = await db
      .insert(organizerProfiles)
      .values({
        userId,
        organizationName: "Cong ty kiem thu",
        taxCode: String(stamp).slice(-10),
        businessLicenseUrl: "https://example.com/license.pdf",
        representativeName: "Dai dien",
        status: "VERIFIED",
      })
      .returning();

    published = await insertEvent(
      profile!.id,
      published.slug,
      EventStatus.PUBLISHED,
    );
    draft = await insertEvent(profile!.id, draft.slug, EventStatus.DRAFT);
    const sale = {
      saleStartTime: new Date("2026-01-01T00:00:00.000Z"),
      saleEndTime: new Date("2026-12-31T00:00:00.000Z"),
      capacity: 10,
    };
    // Chen nguoc thu tu de kiem tra sap xep theo sortOrder.
    await db.insert(ticketTypes).values({
      ...sale,
      eventId: published.id,
      name: "Hang sau",
      price: "600000.00",
      sortOrder: 2,
    });
    await db.insert(ticketTypes).values({
      ...sale,
      eventId: published.id,
      name: "Hang truoc",
      price: "900000.00",
      sortOrder: 1,
      mapZone: "5715",
    });
  });

  after(async () => {
    if (eventIds.length) {
      await db.delete(events).where(inArray(events.id, eventIds));
    }
    await db
      .delete(organizerProfiles)
      .where(eq(organizerProfiles.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
    const redis = app.get<Redis>(REDIS_CLIENT);
    await app.close();
    // Module Redis khong tu dong ket noi khi dong app, tien trinh test se treo.
    await redis.quit();
  });

  it("tra theo slug, kem anh xa so do va hang ve dung thu tu", async () => {
    const { status, body } = await get(published.slug);
    assert.equal(status, 200);
    const event = PublicEventSchema.parse(body.data);
    assert.equal(event.mapKey, "arena-t-stage");
    assert.deepEqual(
      event.ticketTypes.map((t) => [t.name, t.mapZone, t.price]),
      [
        ["Hang truoc", "5715", 900000],
        ["Hang sau", null, 600000],
      ],
    );
  });

  it("tra theo UUID", async () => {
    const { status, body } = await get(published.id);
    assert.equal(status, 200);
    assert.equal(body.data.id, published.id);
  });

  it("su kien chua publish tra 404 ca theo slug lan UUID", async () => {
    assert.equal((await get(draft.slug)).status, 404);
    assert.equal((await get(draft.id)).status, 404);
    assert.equal((await get(randomUUID())).status, 404);
  });

  it("hang ghe tinh ve con lai tu ghe that, khong tu bo dem", async () => {
    const [seatedType] = await db
      .insert(ticketTypes)
      .values({
        eventId: published.id,
        name: "Hang ngoi",
        price: "99000.50",
        capacity: 5,
        sortOrder: 3,
        saleStartTime: new Date("2026-01-01T00:00:00.000Z"),
        saleEndTime: new Date("2026-12-31T00:00:00.000Z"),
      })
      .returning();
    const hour = 60 * 60 * 1000;
    const states = [
      [SeatStatus.SOLD, null],
      [SeatStatus.HELD, new Date(Date.now() + hour)],
      [SeatStatus.BLOCKED, null],
      [SeatStatus.HELD, new Date(Date.now() - hour)],
      [SeatStatus.AVAILABLE, null],
    ] as const;
    await db.insert(seats).values(
      states.map(([status, holdExpiresAt], i) => ({
        eventId: published.id,
        ticketTypeId: seatedType!.id,
        zoneName: "Hang ngoi",
        rowLabel: "A",
        seatNumber: String(i + 1),
        status,
        holdExpiresAt,
      })),
    );

    const { status, body } = await get(published.slug);
    assert.equal(status, 200);
    const type = PublicEventSchema.parse(body.data).ticketTypes.find(
      (item) => item.id === seatedType!.id,
    )!;
    // Ghe giu het han va ghe trong con ban duoc: 2.
    assert.equal(type.capacity - type.heldCount - type.soldCount, 2);
    assert.equal(type.soldCount, 1);
    // Gia le do Ban to chuc nhap khong duoc lam hong ca su kien.
    assert.equal(type.price, 99000.5);
  });

  it("may chu tu choi giu cho ngoai gio ban hoac vuot gioi han hang ve", async () => {
    const insert = async (name: string, start: string, max: number) => {
      const [row] = await db
        .insert(ticketTypes)
        .values({
          eventId: published.id,
          name,
          price: "100000.00",
          capacity: 10,
          isSeated: false,
          maxPerOrder: max,
          saleStartTime: new Date(start),
          saleEndTime: new Date("2099-12-31T00:00:00.000Z"),
        })
        .returning();
      return row!.id;
    };
    // Guard JWT can metadata DI ma tsx khong sinh ra, nen goi thang dich vu.
    const commands = app.get(BookingCommands);
    const rejects = (
      items: { ticketTypeId: string; quantity: number }[],
      code: string,
    ) =>
      assert.rejects(
        commands.holdSeats(userId, { eventId: published.id, items }),
        (err: unknown) =>
          err instanceof BookingDomainError && err.code === code,
      );

    const later = await insert("Chua mo", "2099-01-01T00:00:00.000Z", 6);
    await rejects([{ ticketTypeId: later, quantity: 1 }], "SALE_NOT_OPEN");
    const limited = await insert("Gioi han", "2026-01-01T00:00:00.000Z", 2);
    // Tach thanh hai dong cung khong vuot duoc gioi han.
    await rejects(
      [
        { ticketTypeId: limited, quantity: 2 },
        { ticketTypeId: limited, quantity: 1 },
      ],
      "MAX_PER_ORDER_EXCEEDED",
    );
    const [after] = await db
      .select({ held: ticketTypes.heldCount })
      .from(ticketTypes)
      .where(eq(ticketTypes.id, limited));
    assert.equal(after!.held, 0);
  });

  it("slug trung UUID cua su kien khac khong chiem duoc lien ket", async () => {
    const [profile] = await db
      .select()
      .from(organizerProfiles)
      .where(eq(organizerProfiles.userId, userId));
    await insertEvent(profile!.id, published.id, EventStatus.PUBLISHED);
    const { body } = await get(published.id);
    assert.equal(body.data.id, published.id);
  });
});
