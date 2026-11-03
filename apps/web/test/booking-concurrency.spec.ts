import { test, expect, type APIRequestContext } from "@playwright/test";

const BASE = `${(process.env.API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "")}/api/v1`;
const PASSWORD = process.env.PM_LOAD_BUYER_PASSWORD ?? "Password123!";

const FIXTURES = {
  lastSeat: "pm-concurrency-one-seat",
  freeZone: "pm-concurrency-hundred-seats",
} as const;

type Fixture = { eventId: string; ticketTypeId: string };
type HoldResult = {
  status: number;
  token: string;
  orderId?: string;
  errorCode?: string;
  allocatedSeatIds: string[];
  responseBody: unknown;
};

type JsonObject = Record<string, unknown>;
function object(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

async function getFixture(
  request: APIRequestContext,
  slug: string,
): Promise<Fixture> {
  const response = await request.get(`${BASE}/events/${slug}`);
  expect(
    response.status(),
    `Fixture ${slug} not found. Run the PM seed against a dedicated test database.`,
  ).toBe(200);
  const body = object(await response.json());
  const data = object(body.data);
  const ticketTypes = Array.isArray(data.ticketTypes)
    ? data.ticketTypes
    : Array.isArray(object(data.ticketTypes).items)
      ? (object(data.ticketTypes).items as unknown[])
      : [];
  const ticketType = object(ticketTypes[0]);
  expect(typeof data.id, `Missing event id for ${slug}`).toBe("string");
  expect(
    typeof ticketType.id,
    `GET /events/:slug must return ticketTypes with id for ${slug}`,
  ).toBe("string");
  expect(
    ticketType.isSeated,
    `The fixture ${slug} must use a seated ticket type`,
  ).toBe(true);
  return { eventId: data.id as string, ticketTypeId: ticketType.id as string };
}

async function loginUsers(
  request: APIRequestContext,
  count: number,
): Promise<string[]> {
  const tokens: string[] = [];
  for (let i = 1; i <= count; i++) {
    const email = `pm.load.buyer.${String(i).padStart(3, "0")}@example.test`;
    const response = await request.post(`${BASE}/auth/login`, {
      data: { email, password: PASSWORD },
    });
    expect(
      response.status(),
      `Failed login for ${email}; seed PM buyer accounts first`,
    ).toBe(200);
    const data = object(object(await response.json()).data);
    expect(typeof data.accessToken).toBe("string");
    tokens.push(data.accessToken as string);
  }
  return tokens;
}

async function holdOne(
  request: APIRequestContext,
  token: string,
  fixture: Fixture,
): Promise<HoldResult> {
  const response = await request.post(`${BASE}/booking/hold`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      eventId: fixture.eventId,
      items: [{ ticketTypeId: fixture.ticketTypeId, quantity: 1 }],
    },
    timeout: 120_000,
  });
  const body = object(await response.json());
  const data = object(body.data);
  const error = object(body.error);
  const seats = Array.isArray(data.allocatedSeats) ? data.allocatedSeats : [];
  return {
    status: response.status(),
    token,
    orderId: typeof data.orderId === "string" ? data.orderId : undefined,
    errorCode: typeof error.code === "string" ? error.code : undefined,
    allocatedSeatIds: seats
      .map((s: unknown) => object(s).id)
      .filter((id): id is string => typeof id === "string"),
    responseBody: body,
  };
}

async function releaseOrders(
  request: APIRequestContext,
  results: HoldResult[],
) {
  const failures: string[] = [];
  for (const result of results) {
    if (!result.orderId) continue;
    try {
      const response = await request.post(`${BASE}/booking/release`, {
        headers: { Authorization: `Bearer ${result.token}` },
        data: { orderId: result.orderId },
        timeout: 30_000,
      });
      if (response.status() !== 200)
        failures.push(`${result.orderId}: HTTP ${response.status()}`);
    } catch (error) {
      failures.push(`${result.orderId}: ${String(error)}`);
    }
  }
  expect(failures, `Cleanup failed: ${failures.join("; ")}`).toEqual([]);
}

test.describe("Booking - Auto-Seat Allocation concurrency", () => {
  test.describe.configure({ mode: "serial" });

  test("LOAD01 - 100 requests compete for the last available seat", async ({
    request,
  }) => {
    test.setTimeout(300_000);
    const fixture = await getFixture(request, FIXTURES.lastSeat);
    const tokens = await loginUsers(request, 100);
    const results = await Promise.allSettled(
      tokens.map((token) => holdOne(request, token, fixture)),
    );
    const fulfilled = results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    const winners = fulfilled.filter((r) => r.status === 201);
    try {
      expect(
        results.every((r) => r.status === "fulfilled"),
        "All requests must receive HTTP responses",
      ).toBe(true);
      expect(winners, "Exactly one HTTP 201 winner").toHaveLength(1);
      expect(
        fulfilled.filter(
          (r) =>
            r.status === 409 && r.errorCode === "INSUFFICIENT_TICKET_CAPACITY",
        ),
      ).toHaveLength(99);
      expect(winners[0]?.allocatedSeatIds).toHaveLength(1);
      expect(winners[0]?.orderId).toBeTruthy();
    } finally {
      await releaseOrders(request, winners);
    }
  });

  test("LOAD02 - 50 concurrent buyers receive 50 distinct seats in a 100-seat zone", async ({
    request,
  }) => {
    test.setTimeout(300_000);
    const fixture = await getFixture(request, FIXTURES.freeZone);
    const tokens = await loginUsers(request, 50);
    const results = await Promise.allSettled(
      tokens.map((token) => holdOne(request, token, fixture)),
    );
    const fulfilled = results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    const winners = fulfilled.filter((r) => r.status === 201);
    try {
      expect(
        results.every((r) => r.status === "fulfilled"),
        "All requests must receive HTTP responses",
      ).toBe(true);
      expect(winners, "All 50 requests should succeed").toHaveLength(50);
      expect(winners.every((r) => Boolean(r.orderId))).toBe(true);
      const allocated = winners.flatMap((r) => r.allocatedSeatIds);
      expect(allocated).toHaveLength(50);
      expect(
        new Set(allocated).size,
        "Allocated seat IDs must be unique across all orders",
      ).toBe(50);
    } finally {
      await releaseOrders(request, winners);
    }
  });
});
