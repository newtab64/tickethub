import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { EventStatus } from "@tickethub/shared";
import {
  computeOrganizerMetrics,
  queryOrganizerEvents,
} from "../src/features/organizer/domain/event-query.ts";
import { getDisplayStatus } from "../src/features/organizer/domain/display-status.ts";
import type { OrganizerEventItem } from "../src/features/organizer/domain/organizer.types.ts";
import {
  formatDateVi,
  formatNumberVi,
  formatTimeVi,
} from "../src/shared/lib/format-vi.ts";

const NOW = Date.parse("2026-11-11T10:00:00.000Z");
const day = (n: number) => new Date(NOW + n * 86_400_000).toISOString();

function event(overrides: Partial<OrganizerEventItem>): OrganizerEventItem {
  return {
    id: "e",
    title: "Su kien",
    slug: "su-kien",
    category: "Am nhac",
    bannerUrl: "",
    venueName: "Nha hat",
    venueAddress: "",
    city: "Ha Noi",
    startTime: day(10),
    status: EventStatus.PUBLISHED,
    ticketsSold: 0,
    ticketsTotal: 100,
    revenue: 0,
    version: 1,
    ...overrides,
  };
}

const events = [
  event({
    id: "a",
    title: "Beta",
    startTime: day(5),
    revenue: 100,
    ticketsSold: 10,
  }),
  event({
    id: "b",
    title: "Alpha",
    startTime: day(2),
    revenue: 900,
    ticketsSold: 50,
  }),
  event({
    id: "c",
    title: "Gamma",
    startTime: day(-3),
    status: EventStatus.ENDED,
    revenue: 500,
  }),
  event({
    id: "d",
    title: "Delta",
    city: "TP. Ho Chi Minh",
    status: EventStatus.DRAFT,
    startTime: day(8),
  }),
  event({
    id: "e",
    title: "Echo",
    status: EventStatus.SUSPENDED,
    startTime: day(9),
  }),
];

describe("Organizer domain: event query", () => {
  test("sorts upcoming events first by date and pushes ended ones to the bottom", () => {
    const res = queryOrganizerEvents(events, {}, NOW);
    assert.deepEqual(
      res.items.map((e) => e.id),
      ["b", "a", "d", "e", "c"],
    );
    assert.equal(res.totalCount, 5);
  });

  test("filters by keyword, city and the ACTION_REQUIRED status group", () => {
    assert.deepEqual(
      queryOrganizerEvents(events, { keyword: "alp" }, NOW).items.map(
        (e) => e.id,
      ),
      ["b"],
    );
    assert.deepEqual(
      queryOrganizerEvents(events, { city: "TP. Ho Chi Minh" }, NOW).items.map(
        (e) => e.id,
      ),
      ["d"],
    );
    assert.deepEqual(
      queryOrganizerEvents(
        events,
        { status: "ACTION_REQUIRED" },
        NOW,
      ).items.map((e) => e.id),
      ["d", "e"],
    );
  });

  test("supports revenue and sold sorting and a date window", () => {
    assert.equal(
      queryOrganizerEvents(events, { sort: "revenue_desc" }, NOW).items[0]?.id,
      "b",
    );
    assert.equal(
      queryOrganizerEvents(events, { sort: "sold_desc" }, NOW).items[0]?.id,
      "b",
    );
    const windowed = queryOrganizerEvents(
      events,
      { fromDate: day(4), toDate: day(8.5) },
      NOW,
    );
    assert.deepEqual(windowed.items.map((e) => e.id).sort(), ["a", "d"]);
  });

  test("paginates with a cursor and hasMore", () => {
    const res = queryOrganizerEvents(events, { limit: 2 }, NOW);
    assert.equal(res.items.length, 2);
    assert.equal(res.hasMore, true);
    assert.equal(res.nextCursor, res.items[1]?.id);
    assert.equal(
      queryOrganizerEvents(events, { limit: 10 }, NOW).hasMore,
      false,
    );
  });

  test("computes the summary strip metrics", () => {
    const m = computeOrganizerMetrics(events, NOW);
    assert.equal(m.totalSoldTickets, 60);
    assert.equal(m.totalRevenue, 1500);
    assert.equal(m.upcomingEventsCount, 2);
    assert.equal(m.actionRequiredCount, 2);
  });
});

describe("Organizer domain: display status and formatting", () => {
  test("derives a sold-out display status for fully sold published events", () => {
    const soldOut = getDisplayStatus(
      event({ ticketsSold: 100, ticketsTotal: 100 }),
    );
    assert.equal(soldOut.key, "SOLD_OUT");
    assert.notEqual(getDisplayStatus(event({})).key, "SOLD_OUT");
  });

  test("formats dates, times and numbers in vi-VN and tolerates invalid input", () => {
    assert.equal(formatDateVi("2026-11-11T10:00:00.000Z"), "11/11/2026");
    assert.equal(formatDateVi("not-a-date"), "");
    assert.equal(formatTimeVi(""), "");
    assert.equal(formatNumberVi(1234567), "1.234.567");
  });
});
