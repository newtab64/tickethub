import { test, expect, type APIRequestContext } from "@playwright/test";
import { execFileSync } from "node:child_process";

const BASE = "http://localhost:4000/api/v1";

type TestSeat = {
  seatId: string;
  eventId: string;
  ticketTypeId: string;
};

function queryDB(query: string): string {
  return execFileSync(
    "docker",
    [
      "exec",
      "tickethub-postgres",
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "tickethub",
      "-d",
      "tickethub_dev",
      "-At",
      "-c",
      query,
    ],
    { encoding: "utf8" },
  ).trim();
}

function getTestSeats(): TestSeat[] {
  const rows = queryDB(`
    SELECT s.id, s.event_id, s.ticket_type_id
    FROM seats s
    JOIN events e ON e.id = s.event_id
    WHERE e.slug LIKE 'pm-load-2026-%'
      AND e.is_waiting_room_enabled = false
      AND e.status = 'PUBLISHED'
      AND s.status = 'AVAILABLE'
    ORDER BY e.slug, s.id
    LIMIT 2;
  `);

  return rows
    .split("\n")
    .filter(Boolean)
    .map((row) => {
      const [seatId, eventId, ticketTypeId] = row.split("|");
      return { seatId, eventId, ticketTypeId } as TestSeat;
    });
}

async function loginUsers(
  request: APIRequestContext,
  count: number,
): Promise<string[]> {
  const tokens: string[] = [];

  for (let i = 1; i <= count; i++) {
    const email = `pm.load.buyer.${String(i).padStart(3, "0")}@example.test`;

    const response = await request.post(`${BASE}/auth/login`, {
      data: {
        email,
        password: "Password123!",
      },
    });

    expect(response.status(), `Không đăng nhập được ${email}`).toBe(200);

    const body = await response.json();
    tokens.push(body.data.accessToken);
  }

  return tokens;
}

async function runConcurrencyTest(
  request: APIRequestContext,
  count: number,
  seat: TestSeat,
) {
  const tokens = await loginUsers(request, count);

  const results: Array<{
    status: number;
    orderId?: string;
    error?: string;
    duration: number;
  }> = [];

  const start = Date.now();

  const responses = await Promise.all(
    tokens.map(async (token) => {
      const startedAt = Date.now();

      try {
        const response = await request.post(`${BASE}/booking/hold`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          data: {
            eventId: seat.eventId,
            items: [
              {
                ticketTypeId: seat.ticketTypeId,
                seatId: seat.seatId,
                quantity: 1,
              },
            ],
          },
          timeout: 60_000,
        });

        const body = await response.json();

        return {
          status: response.status(),
          orderId: body.data?.orderId as string | undefined,
          error: body.error?.code as string | undefined,
          duration: Date.now() - startedAt,
        };
      } catch (error) {
        return {
          status: 0,
          error: String(error),
          duration: Date.now() - startedAt,
        };
      }
    }),
  );

  results.push(...responses);

  const elapsed = Date.now() - start;

  const successful = results.filter(
    (r) => r.status === 200 || r.status === 201,
  );

  const conflicts = results.filter((r) => r.status === 409);
  const others = results.filter((r) => ![200, 201, 409].includes(r.status));

  const winner = successful[0];

  console.log(`\n=== LOAD TEST: ${count} REQUESTS ===`);
  console.log("Seat ID:", seat.seatId);
  console.log("Total:", results.length);
  console.log("Successful:", successful.length);
  console.log("Conflicts (409):", conflicts.length);
  console.log("Other responses:", others.length);
  console.log("Total elapsed:", elapsed, "ms");

  const durations = results.map((r) => r.duration).sort((a, b) => a - b);
  const percentile = (p: number) =>
    durations[Math.ceil(p * durations.length) - 1];

  console.log("P95 latency:", percentile(0.95), "ms");
  console.log("P99 latency:", percentile(0.99), "ms");

  if (others.length > 0) {
    console.log("Unexpected:", others.slice(0, 10));
  }

  try {
    const pendingOrders = Number(
      queryDB(`
      SELECT COUNT(*)
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.seat_id = '${seat.seatId}'
        AND o.status = 'PENDING';
    `),
    );

    console.log("Pending orders for seat:", pendingOrders);

    expect(results.length).toBe(count);
    expect(successful.length).toBe(1);
    expect(conflicts.length).toBe(count - 1);
    expect(others.length).toBe(0);
    expect(pendingOrders).toBe(1);
  } finally {
    if (winner?.orderId) {
      const release = await request.post(`${BASE}/booking/release`, {
        headers: {
          Authorization: `Bearer ${tokens[results.indexOf(winner)]}`,
        },
        data: { orderId: winner.orderId },
      });

      console.log("Cleanup release:", release.status());
      expect(release.ok()).toBeTruthy();
    }
  }
}

test.describe("Booking - Concurrency Load Test", () => {
  test.describe.configure({ mode: "serial" });

  test("LOAD01 - 100 requests tranh một ghế", async ({ request }) => {
    test.setTimeout(180_000);

    const seats = getTestSeats();
    expect(seats.length).toBeGreaterThanOrEqual(2);

    await runConcurrencyTest(request, 100, seats[0]!);
  });

  test("LOAD02 - 200 requests tranh một ghế", async ({ request }) => {
    test.setTimeout(180_000);

    const seats = getTestSeats();
    expect(seats.length).toBeGreaterThanOrEqual(2);

    await runConcurrencyTest(request, 200, seats[1]!);
  });
});
