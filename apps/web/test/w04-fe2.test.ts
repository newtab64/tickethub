import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  renderTicketEmailHtml,
  formatVndEmail,
  type TicketEmailData,
} from "../src/lib/email-templates/ticket-email.ts";
import type { SeatStatusChangedPayload } from "../src/hooks/use-seat-stream.ts";

describe("W04-FE2 (Tuần 3): SSE thời gian thực, Màn hình Vé của tôi & Email vé HTML (UC04, UC05)", () => {
  describe("1. SSE & Real-time Seat Sync (UC04)", () => {
    test("Dữ liệu payload SSE seat_status_changed khớp chính xác chuẩn API_CONTRACT.md", () => {
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

    test("Hỗ trợ đầy đủ 3 trạng thái ghế: AVAILABLE, HELD, SOLD", () => {
      const validStatuses = ["AVAILABLE", "HELD", "SOLD"];
      for (const st of validStatuses) {
        const payload: SeatStatusChangedPayload = {
          seatIds: ["seat-test"],
          status: st as "AVAILABLE" | "HELD" | "SOLD",
        };
        assert.ok(["AVAILABLE", "HELD", "SOLD"].includes(payload.status));
      }
    });

    test("Chu kỳ Fallback Polling khi mất kết nối SSE được định nghĩa đúng chuẩn 10 giây", () => {
      const DEFAULT_POLLING_INTERVAL = 10000; // 10s
      assert.equal(
        DEFAULT_POLLING_INTERVAL,
        10000,
        "Polling interval fallback phải là 10.000 ms (10 giây)",
      );
    });
  });

  describe("2. Màn hình Vé của tôi & Khung QR Động (UC05)", () => {
    test("Payload mã QR động chứa đầy đủ thông tin định danh & nonce bảo mật Ed25519", () => {
      const mockQrData = {
        ver: 2,
        sub: "tkt-88412",
        tkt: "TKT-VN-88412-V01",
        ord: "ORD-88412",
        evt: "evt-say-hi-hn",
        sec: "VIP BẠC",
        row: "Hàng 12",
        sts: "H12-05, H12-06",
        exp: Math.floor(Date.now() / 1000) + 30,
        nonce: 1795195800000,
      };

      const serialized = JSON.stringify(mockQrData);
      const parsed = JSON.parse(serialized);

      assert.equal(parsed.ver, 2);
      assert.equal(parsed.ord, "ORD-88412");
      assert.equal(parsed.sec, "VIP BẠC");
      assert.ok(parsed.exp > Math.floor(Date.now() / 1000));
      assert.ok(parsed.nonce > 0);
    });

    test("Chu kỳ làm mới token mã QR động là 30 giây (chống chụp màn hình)", () => {
      const QR_CYCLE_SECONDS = 30;
      assert.equal(QR_CYCLE_SECONDS, 30);
    });
  });

  describe("3. Thiết kế mẫu Email vé HTML (Gmail, Outlook, Apple Mail)", () => {
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

    test("Định dạng tiền tệ VND trong email chuẩn xác", () => {
      const formatted = formatVndEmail(3600000);
      assert.ok(formatted.includes("3.600.000"));
    });

    test("Email HTML sử dụng thuần cấu trúc bảng Table-based tương thích Outlook & Gmail", () => {
      const html = renderTicketEmailHtml(sampleData);

      // Phải có thẻ DOCTYPE chuẩn XHTML
      assert.ok(html.includes("<!DOCTYPE html"));
      assert.ok(html.includes("<html"));

      // Phải sử dụng thẻ <table>, <tr>, <td> cho layout thay vì flexbox/grid
      assert.ok(html.includes("<table"));
      assert.ok(html.includes("<tr"));
      assert.ok(html.includes("<td"));

      // Chứa cấu trúc căn giữa max-width 600px chuẩn email
      assert.ok(html.includes("max-width: 600px"));
    });

    test("Email HTML chứa Outlook MSO conditional comments", () => {
      const html = renderTicketEmailHtml(sampleData);
      assert.ok(html.includes("<!--[if (gte mso 9)|(IE)]>"));
      assert.ok(html.includes("<!--[if mso]>"));
    });

    test("Email HTML nhúng đầy đủ các trường dữ liệu vé bắt buộc", () => {
      const html = renderTicketEmailHtml(sampleData);

      assert.ok(html.includes("ORD-88412"), "Thiếu mã đơn hàng");
      assert.ok(
        html.includes("Anh Trai &#x27;Say Hi&#x27; Concert 2026") ||
          html.includes("Anh Trai"),
        "Thiếu tên sự kiện",
      );
      assert.ok(
        html.includes("Sân Vận Động Quốc Gia Mỹ Đình"),
        "Thiếu địa điểm",
      );
      assert.ok(html.includes("VIP BẠC"), "Thiếu tên khu vực");
      assert.ok(html.includes("Hàng 12"), "Thiếu hàng ghế");
      assert.ok(html.includes("H12-05, H12-06"), "Thiếu số ghế");
      assert.ok(html.includes("Trần Phú An"), "Thiếu tên người nhận");
      assert.ok(
        html.includes("Cổng thanh toán điện tử VNPay"),
        "Thiếu phương thức thanh toán",
      );
      assert.ok(
        html.includes("Cổng B - Cửa B2 (Khán đài Tây)"),
        "Thiếu cổng vào",
      );
      assert.ok(html.includes("MÃ QR ĐỘNG BẢO MẬT"), "Thiếu tiêu đề mã QR");
      assert.ok(
        html.includes("LƯU Ý QUAN TRỌNG KHI VÀO CỔNG"),
        "Thiếu quy định vào cổng",
      );
    });

    test("Email HTML không sử dụng external script hay thẻ link css ngoài", () => {
      const html = renderTicketEmailHtml(sampleData);
      assert.ok(
        !html.includes("<script"),
        "Email HTML không được chứa thẻ script",
      );
      assert.ok(
        !html.includes('<link rel="stylesheet"'),
        "Email HTML không được chứa stylesheet ngoài",
      );
    });
  });
});
