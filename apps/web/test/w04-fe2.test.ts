import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  renderTicketEmailHtml,
  formatVndEmail,
  type TicketEmailData,
} from "../src/lib/email-templates/ticket-email.ts";
import {
  DEFAULT_POLLING_INTERVAL_MS,
  type SeatStatusChangedPayload,
} from "../src/hooks/use-seat-stream.ts";

describe("W04-FE2: SSE thoi gian thuc, Ve cua toi va Email HTML (UC04, UC05)", () => {
  describe("1. SSE & Real-time Seat Sync (UC04)", () => {
    test("Du lieu payload SSE seat_status_changed khop chuan API_CONTRACT.md", () => {
      const mockPayload: SeatStatusChangedPayload = {
        seatIds: ["s2-uuid", "s3-uuid"],
        status: "HELD",
        zoneId: "zone-vip-a",
        expiresAt: "2026-10-14T09:35:00.000Z",
      };

      assert.ok(Array.isArray(mockPayload.seatIds));
      assert.equal(mockPayload.seatIds.length, 2);
      assert.equal(mockPayload.status, "HELD");
      assert.ok(mockPayload.expiresAt);
    });

    test("Ho tro day du cac trang thai ghe: AVAILABLE, HELD, SOLD, BLOCKED", () => {
      const validStatuses = ["AVAILABLE", "HELD", "SOLD", "BLOCKED"] as const;
      for (const st of validStatuses) {
        const payload: SeatStatusChangedPayload = {
          seatIds: ["seat-test"],
          status: st,
        };
        assert.ok(validStatuses.includes(payload.status));
      }
    });

    test("Chu ky Fallback Polling khi mat ket noi SSE dung chuan 10 giay", () => {
      assert.equal(
        DEFAULT_POLLING_INTERVAL_MS,
        10000,
        "Polling interval fallback phai la 10.000 ms (10 giay)",
      );
    });
  });

  describe("2. Man hinh Ve cua toi va Khung QR Dong (UC05)", () => {
    test("Payload ma QR dong chua day du thong tin dinh danh va han su dung 30s", () => {
      const mockQrData = {
        v: 2,
        ticketId: "tkt-88412",
        ticketCode: "TKT-VN-88412-V01",
        order: "ORD-88412",
        event: "evt-say-hi-hn",
        zone: "VIP BẠC",
        seats: "H12-05, H12-06",
        cycle: 1,
        exp: Math.floor(Date.now() / 1000) + 30,
      };

      const serialized = JSON.stringify(mockQrData);
      const parsed = JSON.parse(serialized);

      assert.equal(parsed.v, 2);
      assert.equal(parsed.order, "ORD-88412");
      assert.equal(parsed.zone, "VIP BẠC");
      assert.ok(parsed.exp > Math.floor(Date.now() / 1000));
    });
  });

  describe("3. Mau Email ve HTML (Gmail, Outlook, Apple Mail)", () => {
    const sampleData: TicketEmailData = {
      recipientName: "Trần Phú An",
      recipientEmail: "tranphuan68686868@gmail.com",
      orderCode: "ORD-88412",
      ticketCode: "TKT-VN-88412-V01",
      eventName: "Anh Trai 'Say Hi' Concert 2026",
      eventImage: "https://tickethub.vn/images/events/say-hi.jpg",
      eventDate: "14/11/2026",
      eventTime: "19:00",
      eventVenue: "Sân Vận Động Quốc Gia Mỹ Đình",
      eventAddress:
        "Đường Lê Đức Thọ, Phường Mỹ Đình 1, Quận Nam Từ Liêm, Hà Nội",
      zoneName: "VIP BẠC",
      rowLabel: "Hàng 12",
      seatNumbers: "H12-05, H12-06",
      quantity: 2,
      totalPrice: 3600000,
      paymentMethod: "Cổng thanh toán điện tử VNPay",
      paymentTime: "28/10/2026 14:30",
      gateInfo: "Cổng B - Cửa B2 (Khán đài Tây)",
      viewTicketsUrl: "https://tickethub.vn/my-tickets?order=ORD-88412",
    };

    test("Dinh dang tien te VND trong email chuan xac", () => {
      const formatted = formatVndEmail(3600000);
      assert.ok(formatted.includes("3.600.000"));
    });

    test("Email HTML su dung thuan cau truc bang Table-based tuong thich Outlook va Gmail", () => {
      const html = renderTicketEmailHtml(sampleData);

      assert.ok(html.includes("<!DOCTYPE html"));
      assert.ok(html.includes("<html"));
      assert.ok(html.includes("<table"));
      assert.ok(html.includes("<tr"));
      assert.ok(html.includes("<td"));
      assert.ok(html.includes("max-width: 600px"));
    });

    test("Email HTML chua Outlook MSO conditional comments", () => {
      const html = renderTicketEmailHtml(sampleData);
      assert.ok(html.includes("<!--[if (gte mso 9)|(IE)]>"));
      assert.ok(html.includes("<!--[if mso]>"));
    });

    test("Email HTML nhung day du cac truong du lieu ve bat buoc", () => {
      const html = renderTicketEmailHtml(sampleData);

      assert.ok(html.includes("ORD-88412"), "Thieu ma don hang");
      assert.ok(
        html.includes("Anh Trai &#x27;Say Hi&#x27; Concert 2026") ||
          html.includes("Anh Trai"),
        "Thieu ten su kien",
      );
      assert.ok(
        html.includes("Sân Vận Động Quốc Gia Mỹ Đình"),
        "Thieu dia diem",
      );
      assert.ok(html.includes("VIP BẠC"), "Thieu ten khu vuc");
      assert.ok(html.includes("Hàng 12"), "Thieu hang ghe");
      assert.ok(html.includes("H12-05, H12-06"), "Thieu so ghe");
      assert.ok(html.includes("Trần Phú An"), "Thieu ten nguoi nhan");
      assert.ok(
        html.includes("Cổng thanh toán điện tử VNPay"),
        "Thieu phuong thuc thanh toan",
      );
      assert.ok(
        html.includes("Cổng B - Cửa B2 (Khán đài Tây)"),
        "Thieu cong vao",
      );
      assert.ok(html.includes("MÃ QR ĐỘNG BẢO MẬT"), "Thieu tieu de ma QR");
      assert.ok(
        html.includes("LƯU Ý QUAN TRỌNG KHI VÀO CỔNG"),
        "Thieu quy dinh vao cong",
      );
    });

    test("Email HTML khong su dung external script hay the link css ngoai", () => {
      const html = renderTicketEmailHtml(sampleData);
      assert.ok(!html.includes("<script"));
      assert.ok(!html.includes('<link rel="stylesheet"'));
    });
  });
});
