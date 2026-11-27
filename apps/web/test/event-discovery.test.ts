import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { PublicEvent } from "@tickethub/shared";
import {
  categoryCode,
  dateFilterOptions,
  filterEventCards,
  toEventCards,
  type EventCard,
} from "../src/features/event/domain/event-discovery.ts";

// Thu Sau 27/11/2026, 10:00 gio Viet Nam.
const FRIDAY = Date.parse("2026-11-27T03:00:00.000Z");

const card = (
  slug: string,
  startTime: string,
  overrides: Partial<EventCard> = {},
): EventCard => ({
  id: slug,
  slug,
  title: slug,
  category: "CONCERT",
  startTime,
  endTime: startTime,
  venueName: "Nhà hát",
  city: "Hà Nội",
  bannerUrl: "",
  minPrice: 100,
  ...overrides,
});

const all = { category: "ALL", city: null, date: "ALL", query: "" } as const;
const slugs = (cards: EventCard[]) => cards.map((c) => c.slug);

describe("Event discovery: cards", () => {
  const event = (slug: string, start: string, prices: number[]) =>
    ({
      id: slug,
      slug,
      title: slug,
      category: "Thể thao",
      startTime: start,
      endTime: start,
      venueName: "San",
      city: "Hà Nội",
      bannerUrl: "",
      ticketTypes: prices.map((price) => ({ price })),
    }) as unknown as PublicEvent;

  test("drops finished events, sorts by start and takes the lowest price", () => {
    const cards = toEventCards(
      [
        event("sau", "2026-12-20T13:00:00.000Z", [500, 200]),
        event("da-xong", "2026-11-01T13:00:00.000Z", [100]),
        event("truoc", "2026-12-01T13:00:00.000Z", []),
      ],
      FRIDAY,
    );
    assert.deepEqual(slugs(cards), ["truoc", "sau"]);
    assert.deepEqual(
      cards.map((c) => [c.minPrice, c.category]),
      [
        [null, "SPORT"],
        [200, "SPORT"],
      ],
    );
  });

  test("maps database categories and rejects unknown ones", () => {
    assert.equal(categoryCode("Âm nhạc"), "CONCERT");
    assert.equal(categoryCode("Thể thao"), "SPORT");
    assert.equal(categoryCode("Sân khấu & Nghệ thuật"), "THEATER");
    assert.equal(categoryCode("Khác"), null);
    assert.equal(categoryCode("toString"), null);
  });
});

describe("Event discovery: filters", () => {
  const cards = [
    card("t6", "2026-11-27T13:00:00.000Z"),
    card("t7", "2026-11-28T13:00:00.000Z", { category: "SPORT" }),
    card("cn", "2026-11-29T13:00:00.000Z", { city: "Đà Nẵng" }),
    card("t2", "2026-11-30T13:00:00.000Z", { category: null }),
    // 00:30 ngay 01/01/2027 gio Viet Nam.
    card("nam-moi", "2026-12-31T17:30:00.000Z"),
  ];

  test("lists months in Vietnam time", () => {
    assert.deepEqual(dateFilterOptions(cards), [
      "ALL",
      "WEEKEND",
      "2026-11",
      "2027-01",
    ]);
    assert.deepEqual(
      slugs(filterEventCards(cards, { ...all, date: "2027-01" }, FRIDAY)),
      ["nam-moi"],
    );
  });

  test("weekend means the coming Saturday and Sunday", () => {
    const weekend = { ...all, date: "WEEKEND" } as const;
    assert.deepEqual(slugs(filterEventCards(cards, weekend, FRIDAY)), [
      "t7",
      "cn",
    ]);
    const sunday = Date.parse("2026-11-29T03:00:00.000Z");
    assert.deepEqual(slugs(filterEventCards(cards, weekend, sunday)), [
      "t7",
      "cn",
    ]);
  });

  test("filters by category, city and accent insensitive text", () => {
    assert.deepEqual(
      slugs(filterEventCards(cards, { ...all, category: "SPORT" }, FRIDAY)),
      ["t7"],
    );
    assert.deepEqual(
      slugs(filterEventCards(cards, { ...all, city: "Đà Nẵng" }, FRIDAY)),
      ["cn"],
    );
    assert.equal(
      filterEventCards(cards, { ...all, query: "ha noi" }, FRIDAY).length,
      4,
    );
    assert.deepEqual(
      slugs(filterEventCards(cards, { ...all, query: "DA NANG" }, FRIDAY)),
      ["cn"],
    );
  });

  test("unknown categories only appear under all", () => {
    assert.ok(slugs(filterEventCards(cards, all, FRIDAY)).includes("t2"));
    for (const category of ["CONCERT", "SPORT", "THEATER"] as const) {
      assert.ok(
        !slugs(filterEventCards(cards, { ...all, category }, FRIDAY)).includes(
          "t2",
        ),
      );
    }
  });
});
