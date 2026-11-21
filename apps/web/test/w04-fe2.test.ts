import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  renderTicketEmailHtml,
  formatVndEmail,
  type TicketEmailData,
} from "../src/features/ticketing/domain/ticket-email.ts";
import {
  QR_ROTATION_SECONDS,
  buildTicketFallbackQrPayload,
  filterTicketsByTab,
  formatTicketVnd,
  normalizeTicketStatus,
  type BoardingPassTicketView,
} from "../src/features/ticketing/domain/ticket-rules.ts";
import {
  DEFAULT_POLLING_INTERVAL_MS,
  buildSeatInventoryUrl,
  buildSeatStreamUrl,
  parseSeatStreamPayload,
} from "../src/features/booking/api/seat-stream-client.ts";

describe("W04-FE2: Dong bo ghe thoi gian thuc, Ve cua toi va Email HTML (UC04, UC05)", () => {
  describe("1. Dong bo ghe thoi gian thuc (seat-stream-client)", () => {
    test("Tao dung duong dan luong SSE va du phong inventory", () => {
      assert.ok(
        buildSeatStreamUrl("evt-123").endsWith("/events/evt-123/seats/stream"),
      );
      assert.ok(
        buildSeatInventoryUrl("evt-123").endsWith("/events/evt-123/inventory"),
      );
      assert.equal(DEFAULT_POLLING_INTERVAL_MS, 10_000);
    });

    test("Phan tich hop le du lieu seat_status_changed va bo qua du lieu hong", () => {
      const valid = parseSeatStreamPayload(
        JSON.stringify({
          seatIds: ["s-1", "s-2"],
          status: "HELD",
          zoneId: "zone-vip",
          expiresAt: "2026-11-20T10:05:00.000Z",
        }),
      );
      assert.deepEqual(valid, {
        seatIds: ["s-1", "s-2"],
        status: "HELD",
        zoneId: "zone-vip",
        expiresAt: "2026-11-20T10:05:00.000Z",
      });

      assert.equal(parseSeatStreamPayload("not-json"), null);
      assert.equal(
        parseSeatStreamPayload(
          JSON.stringify({ seatIds: ["s-1"], status: "INVALID" }),
        ),
        null,
      );
    });
  });

  describe("2. Quy tac Ve cua toi va ma QR dong 30 giay (ticket-rules)", () => {
    const sampleTickets: BoardingPassTicketView[] = [
      {
        ticketId: "t-1",
        ticketCode: "TH-001",
        orderCode: "ORD-001",
        eventId: "evt-1",
        eventTitle: "Dem nhac mua thu",
        eventImage: "/images/a.jpg",
        fullDateTime: "20/12/2026 20:00",
        venue: "Nha hat Lon",
        city: "Ha Noi",
        zoneName: "VIP",
        rowLabel: "Hang A",
        seatNumbers: "A-01",
        quantity: 1,
        totalPrice: 1500000,
        status: "ISSUED",
        isFromApi: true,
      },
      {
        ticketId: "t-2",
        ticketCode: "TH-002",
        orderCode: "ORD-002",
        eventId: "evt-1",
        eventTitle: "Dem nhac mua thu",
        eventImage: "/images/a.jpg",
        fullDateTime: "20/12/2026 20:00",
        venue: "Nha hat Lon",
        city: "Ha Noi",
        zoneName: "Standard",
        rowLabel: "Hang C",
        seatNumbers: "C-10",
        quantity: 1,
        totalPrice: 800000,
        status: "CHECKED_IN",
        isFromApi: true,
      },
    ];

    test("Loc danh sach ve theo tab trang thai chinh xac", () => {
      assert.equal(filterTicketsByTab(sampleTickets, "ALL").length, 2);
      assert.equal(filterTicketsByTab(sampleTickets, "ISSUED").length, 1);
      assert.equal(filterTicketsByTab(sampleTickets, "CHECKED_IN").length, 1);
      assert.equal(filterTicketsByTab(sampleTickets, "CANCELLED").length, 0);
    });

    test("Chuan hoa trang thai ve va dinh dang tien te VND", () => {
      assert.equal(normalizeTicketStatus("REFUNDED"), "CANCELLED");
      assert.equal(normalizeTicketStatus("CHECKED_IN"), "CHECKED_IN");
      assert.equal(normalizeTicketStatus("ISSUED"), "ISSUED");
      assert.ok(formatTicketVnd(1500000).includes("1.500.000"));
    });

    test("Tao payload QR dong co han su dung dung 30 giay", () => {
      assert.equal(QR_ROTATION_SECONDS, 30);
      const now = 1_700_000_000_000;
      const raw = buildTicketFallbackQrPayload(sampleTickets[0]!, 3, now);
      const parsed = JSON.parse(raw) as {
        ticketId: string;
        ticketCode: string;
        tick: number;
        exp: number;
      };
      assert.equal(parsed.ticketId, "t-1");
      assert.equal(parsed.ticketCode, "TH-001");
      assert.equal(parsed.tick, 3);
      assert.equal(parsed.exp, now + 30_000);
    });
  });

  describe("3. Mau Email ve HTML (ticket-email)", () => {
    const sampleData: TicketEmailData = {
      recipientName: "Tran Phu An",
      recipientEmail: "tranphuan686868@gmail.com",
      orderCode: "ORD-88412",
      ticketCode: "TH-88412-01",
      eventName: "Liveshow Am Nhac Mua Thu 2026",
      eventImage: "https://tickethub.vn/images/event.jpg",
      eventDate: "20/12/2026",
      eventTime: "20:00",
      eventVenue: "Nha hat Lon",
      eventAddress: "Ha Noi",
      zoneName: "VIP Bac",
      rowLabel: "Hang A",
      seatNumbers: "A-01, A-02",
      quantity: 2,
      totalPrice: 3600000,
      paymentMethod: "VNPay",
      paymentTime: "10:30 15/11/2026",
      viewTicketsUrl: "https://tickethub.vn/my-tickets?order=ORD-88412",
    };

    test("Dinh dang tien te VND trong email chuan xac", () => {
      const formatted = formatVndEmail(3600000);
      assert.ok(formatted.includes("3.600.000"));
    });

    test("Email HTML dung cau truc bang, co MSO conditional comments va khong chen script ngoai", () => {
      const html = renderTicketEmailHtml(sampleData);
      assert.ok(html.includes("<table"));
      assert.ok(html.includes("<!--[if mso]>"));
      assert.ok(html.includes(sampleData.orderCode));
      assert.ok(html.includes(sampleData.eventName));
      assert.equal(html.includes("<script"), false);
    });
  });
});
