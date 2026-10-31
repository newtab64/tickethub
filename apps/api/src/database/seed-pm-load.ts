import { eq, like, sql } from "drizzle-orm";
import { db, sqlClient } from "./db";
import { users, organizerProfiles, events, ticketTypes, seats } from "./schema";
import {
    EventStatus,
    RefundPolicyType,
    SeatStatus,
    UserRole,
    UserStatus,
} from "@tickethub/shared";
import { env } from "../config/env.config";

const EVENT_COUNT = 50;
const SEATS_PER_EVENT = 100;
const BUYER_COUNT = 300;
const PREFIX = "pm-load-2026-";
const EMAIL_DOMAIN = "example.test";
const DEFAULT_PASSWORD_HASH =
    "$argon2id$v=19$m=65536,p=4,t=3$ZizAyGaEgeq8Olc9I4nW4g$kJQV9gHwtfhN6I8kFpDZ6fIfV+VNfn9tMTB9jtyYukA";

function assertLocalDatabase() {
    const parsed = new URL(env.DATABASE_URL);
    const permittedHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
    const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    if (!permittedHosts.has(parsed.hostname) || !/(_dev|_test)$/.test(databaseName)) {
        throw new Error(
            `REFUSED: dataset only permitted on localhost and a database ending _dev or _test (database=${databaseName}).`,
        );
    }
    console.log(`PM seed target: ${parsed.hostname}:${parsed.port || "5432"}/${databaseName}`);
}

function schedule(index: number) {
    const base = new Date();
    base.setUTCDate(base.getUTCDate() + 30 + index);
    base.setUTCHours(12, 0, 0, 0);
    const startTime = base;
    const endTime = new Date(base.getTime() + 3 * 60 * 60 * 1000);
    const gateOpeningTime = new Date(base.getTime() - 60 * 60 * 1000);
    const saleStartTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const saleEndTime = new Date(base.getTime() - 2 * 60 * 60 * 1000);
    return { startTime, endTime, gateOpeningTime, saleStartTime, saleEndTime };
}

async function seedPmLoad() {
    assertLocalDatabase();
    const [organizer] = await db.select().from(organizerProfiles).limit(1);
    if (!organizer) {
        throw new Error("Organizer profile missing. Run `pnpm db:seed` first.");
    }

    const existingPmEvents = await db
        .select({ id: events.id, slug: events.slug })
        .from(events)
        .where(like(events.slug, `${PREFIX}%`));
    if (existingPmEvents.length > 0 && existingPmEvents.length !== EVENT_COUNT) {
        throw new Error(
            `Found ${existingPmEvents.length}/${EVENT_COUNT} PM events. Refusing partial rerun. Inspect test DB before retrying.`,
        );
    }

    const cities = ["Hà Nội", "Hồ Chí Minh", "Đà Nẵng", "Cần Thơ", "Huế"];
    const categories = ["Âm nhạc", "Hội thảo", "Triển lãm", "Thể thao", "Công nghệ"];

    for (let index = 1; index <= EVENT_COUNT; index++) {
        const slug = `${PREFIX}${String(index).padStart(2, "0")}`;
        const [existing] = await db.select({ id: events.id }).from(events).where(eq(events.slug, slug)).limit(1);
        if (existing) {
            const [countRow] = await db
                .select({ count: sql<number>`count(*)::int` })
                .from(seats)
                .where(eq(seats.eventId, existing.id));
            if (Number(countRow?.count) !== SEATS_PER_EVENT) {
                throw new Error(`${slug}: expected ${SEATS_PER_EVENT} seats; got ${countRow?.count}. Manual inspection required.`);
            }
            continue;
        }

        const timing = schedule(index);
        const category = categories[(index - 1) % categories.length]!;
        const city = cities[(Math.floor((index - 1) / categories.length)) % cities.length]!;
        const [newEvent] = await db.insert(events).values({
            organizerId: organizer.id,
            title: `[PM TEST] ${category} ${city} #${String(index).padStart(2, "0")}`,
            slug,
            description: `Sự kiện mô phỏng phục vụ kiểm thử UC02 UC03 UC04, mã ${slug}. Không dùng để bán vé thật.`,
            category,
            bannerUrl: "https://example.test/test-banner.png",
            venueName: `Nhà thi đấu kiểm thử ${city}`,
            venueAddress: `Số ${index}, Đường Kiểm Thử, ${city}`,
            city,
            startTime: timing.startTime,
            endTime: timing.endTime,
            gateOpeningTime: timing.gateOpeningTime,
            status: EventStatus.PUBLISHED,
            isWaitingRoomEnabled: index <= 10,
            maxActiveUsers: 20,
            refundPolicyType: RefundPolicyType.FLEXIBLE,
            refundPolicyRules: [],
        }).returning({ id: events.id });
        if (!newEvent) throw new Error(`Could not create ${slug}`);

        const [newType] = await db.insert(ticketTypes).values({
            eventId: newEvent.id,
            name: "PM Test Zone A",
            description: "100 seats for repeatable API load tests",
            price: String(100000 + (index % 5) * 100000),
            capacity: SEATS_PER_EVENT,
            isSeated: true,
            saleStartTime: timing.saleStartTime,
            saleEndTime: timing.saleEndTime,
            maxPerOrder: 6,
            sortOrder: 1,
        }).returning({ id: ticketTypes.id });
        if (!newType) throw new Error(`Could not create ticket type for ${slug}`);

        const seatRows = Array.from({ length: SEATS_PER_EVENT }, (_, offset) => ({
            eventId: newEvent.id,
            ticketTypeId: newType.id,
            zoneName: "PM Test Zone A",
            rowLabel: String.fromCharCode(65 + Math.floor(offset / 10)),
            seatNumber: String((offset % 10) + 1).padStart(2, "0"),
            status: SeatStatus.AVAILABLE,
        }));
        await db.insert(seats).values(seatRows);
        console.log(`Created event ${index}/${EVENT_COUNT}: ${slug} (100 seats)`);
    }

    for (let index = 1; index <= BUYER_COUNT; index += 50) {
        const chunk = Array.from({ length: Math.min(50, BUYER_COUNT - index + 1) }, (_, k) => {
            const n = index + k;
            return {
                email: `pm.load.buyer.${String(n).padStart(3, "0")}@${EMAIL_DOMAIN}`,
                fullName: `PM Load Buyer ${String(n).padStart(3, "0")}`,
                passwordHash: DEFAULT_PASSWORD_HASH,
                role: UserRole.BUYER,
                status: UserStatus.ACTIVE,
                emailVerifiedAt: new Date(),
            };
        });
        await db.insert(users).values(chunk).onConflictDoNothing();
    }

    const [eventSummary] = await db.select({ count: sql<number>`count(*)::int` })
        .from(events).where(like(events.slug, `${PREFIX}%`));
    const [buyerSummary] = await db.select({ count: sql<number>`count(*)::int` })
        .from(users).where(like(users.email, `pm.load.buyer.%@${EMAIL_DOMAIN}`));
    console.log(`PM dataset: ${eventSummary?.count} events, target ${EVENT_COUNT * SEATS_PER_EVENT} seats, ${buyerSummary?.count} buyer accounts.`);
    console.log("NOTE: Redis inventory is not automatically initialized by this script.");
}

seedPmLoad()
    .catch((error) => {
        console.error("PM seed failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await sqlClient.end();
    });
