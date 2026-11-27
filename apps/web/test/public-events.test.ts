import { describe, test, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
  fetchPublicEvent,
  fetchPublicEvents,
} from "../src/features/event/api/public-events.ts";
import {
  availabilityLabel,
  formatEventDateTime,
  remainingTickets,
} from "../src/features/event/domain/event-format.ts";

const ID = "b220b046-42a9-4c1e-9f0e-0d6f6a1f2c11";
const event = {
  id: ID,
  slug: "su-kien",
  title: "Su kien",
  description: "Mo ta",
  category: "Âm nhạc",
  bannerUrl: "/images/events/vn/anh-trai.jpg",
  venueName: "Nha hat",
  venueAddress: "1 Trang Tien",
  city: "Hà Nội",
  startTime: "2026-12-01T12:00:00.000Z",
  endTime: "2026-12-01T15:00:00.000Z",
  gateOpeningTime: "2026-12-01T11:00:00.000Z",
  mapKey: null,
  ticketTypes: [
    {
      id: ID,
      name: "GA",
      description: null,
      price: "600000.00",
      capacity: 10,
      heldCount: 0,
      soldCount: 0,
      isSeated: false,
      saleStartTime: "2026-01-01T00:00:00.000Z",
      saleEndTime: "2026-11-30T00:00:00.000Z",
      maxPerOrder: 6,
      mapZone: null,
    },
  ],
};

describe("Public event API client", () => {
  const paths: string[] = [];
  let list: { status: number; body: unknown } = { status: 200, body: {} };
  const server = createServer((req, res) => {
    paths.push(req.url ?? "");
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.url?.includes("/events?")) {
      return send(list.status, list.body);
    }
    if (req.url?.endsWith("/events/su-kien")) {
      return send(200, { success: true, data: event });
    }
    if (req.url?.endsWith("/events/hong")) {
      return send(200, { success: true, data: { id: "x" } });
    }
    if (req.url?.endsWith("/events/loi")) return send(500, {});
    send(404, { success: false });
  });
  const ready = new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      process.env.API_URL = `http://127.0.0.1:${port}/api/v1`;
      resolve();
    }),
  );
  after(() => server.close());

  test("tra ve su kien va doi gia sang so", async () => {
    await ready;
    const result = await fetchPublicEvent("su-kien");
    assert.equal(result?.ticketTypes[0]?.price, 600000);
  });

  test("404 tra ve null", async () => {
    await ready;
    assert.equal(await fetchPublicEvent("khong-co"), null);
  });

  test("loi may chu hoac du lieu sai thi nem loi, khong gia lam khong tim thay", async () => {
    await ready;
    await assert.rejects(fetchPublicEvent("loi"), /Không tải được sự kiện/);
    await assert.rejects(fetchPublicEvent("hong"), /Không tải được sự kiện/);
  });

  test("ma hoa dinh danh trong duong dan", async () => {
    await ready;
    await fetchPublicEvent("a/b?c");
    assert.equal(paths.at(-1), "/api/v1/events/a%2Fb%3Fc");
  });

  test("danh sach bo qua rieng su kien sai du lieu", async () => {
    await ready;
    list = {
      status: 200,
      body: { success: true, data: { items: [{ id: "hong" }, event] } },
    };
    const result = await fetchPublicEvents();
    assert.deepEqual(
      result.map((item) => item.slug),
      ["su-kien"],
    );
    assert.equal(paths.at(-1), "/api/v1/events?limit=50");
  });

  test("danh sach loi may chu hoac sai dang thi nem loi", async () => {
    await ready;
    list = { status: 500, body: {} };
    await assert.rejects(fetchPublicEvents(), /Không tải được sự kiện/);
    list = { status: 200, body: { success: true, data: {} } };
    await assert.rejects(fetchPublicEvents(), /Không tải được sự kiện/);
  });

  test("may chu khong phan hoi thi nem loi", async () => {
    await ready;
    const base = process.env.API_URL;
    process.env.API_URL = "http://127.0.0.1:1/api/v1";
    await assert.rejects(fetchPublicEvent("su-kien"), /Không tải được sự kiện/);
    process.env.API_URL = base;
  });
});

describe("Event format", () => {
  test("hien gio Viet Nam", () => {
    const text = formatEventDateTime("2026-12-01T12:00:00.000Z");
    assert.match(text, /19:00/);
    assert.match(text, /2026/);
  });

  test("so ve con lai khong am", () => {
    assert.equal(
      remainingTickets({ capacity: 5, heldCount: 3, soldCount: 4 }),
      0,
    );
    assert.equal(
      remainingTickets({ capacity: 10, heldCount: 2, soldCount: 3 }),
      5,
    );
  });

  test("nhan tinh trang ve", () => {
    assert.equal(availabilityLabel(0), "Hết vé");
    assert.equal(availabilityLabel(9), "Sắp hết");
    assert.equal(availabilityLabel(10), "Còn vé");
  });
});
