import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  resultView,
  type ResultState,
} from "../src/features/payment/domain/payment-result.ts";

// Đúng từng dòng của bảng trạng thái trong thiết kế.
const TABLE: [ResultState, string, string, string, string, string, string][] = [
  [
    "success",
    "success",
    "Thanh toán thành công",
    "Xem vé",
    "order",
    "Về trang chủ",
    "/",
  ],
  [
    "processing",
    "warning",
    "Đang chờ xác nhận thanh toán",
    "Kiểm tra lại",
    "retry",
    "Xem đơn hàng",
    "order",
  ],
  [
    "refund_pending",
    "warning",
    "Đang hoàn tiền",
    "Xem tiến độ hoàn tiền",
    "order",
    "Xem Trợ giúp",
    "/faq",
  ],
  [
    "failed",
    "destructive",
    "Thanh toán không thành công",
    "Xem đơn hàng",
    "order",
    "Xem Trợ giúp",
    "/faq",
  ],
  [
    "refunded",
    "neutral",
    "Đơn đã hủy toàn bộ vé",
    "Xem chi tiết đơn",
    "order",
    "Về trang chủ",
    "/",
  ],
  [
    "unknown",
    "neutral",
    "Chưa xác định được đơn",
    "Xem Vé của tôi",
    "orders",
    "Xem Trợ giúp",
    "/faq",
  ],
  [
    "error",
    "neutral",
    "Chưa kiểm tra được thanh toán",
    "Kiểm tra lại",
    "retry",
    "Xem Vé của tôi",
    "/buyer/orders",
  ],
];

describe("Nội dung trang kết quả thanh toán", () => {
  for (const [state, tone, title, primary, kind, secondary, href] of TABLE) {
    test(state, () => {
      const view = resultView(state);
      assert.equal(view.tone, tone);
      assert.equal(view.title, title);
      assert.deepEqual(view.primary, { label: primary, kind });
      assert.deepEqual(view.secondary, { label: secondary, href });
    });
  }

  test("câu giải thích đúng thiết kế", () => {
    assert.deepEqual(
      TABLE.map(([state]) => resultView(state).text),
      [
        "Vé đã sẵn sàng. Mở mã QR khi đến cổng.",
        "Trang tự cập nhật. Nếu đã bị trừ tiền, đừng thanh toán lại.",
        "Thanh toán đến muộn nên không cấp được vé. Tiền đang được hoàn lại cho bạn.",
        "Nếu đã bị trừ tiền, hãy liên hệ hỗ trợ và gửi kèm mã đơn.",
        "Xem tiến độ hoàn tiền trong chi tiết đơn.",
        "Hãy kiểm tra trong Vé của tôi trước khi thanh toán lại.",
        "",
      ],
    );
  });
});
