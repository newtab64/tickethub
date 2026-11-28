import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  detailedState,
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

TABLE.push(
  [
    "expired",
    "destructive",
    "Thanh toán không thành công",
    "Kiểm tra lại",
    "retry",
    "Xem đơn hàng",
    "order",
  ],
  [
    "refund_failed",
    "destructive",
    "Chưa hoàn được tiền",
    "Xem đơn hàng",
    "order",
    "Xem Trợ giúp",
    "/faq",
  ],
);

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
        "Nếu đã bị trừ tiền, đừng thanh toán lại. Hãy liên hệ hỗ trợ và gửi kèm mã đơn.",
        "Hoàn tiền chưa thực hiện được. Hãy liên hệ hỗ trợ kèm mã đơn.",
      ],
    );
  });
});

describe("Trạng thái chi tiết", () => {
  const refunds = (...status: string[]) => status.map((s) => ({ status: s }));

  test("đơn hết hạn tách khỏi thất bại vì có thể vẫn được cấp vé", () => {
    assert.equal(detailedState("failed", "EXPIRED", []), "expired");
    assert.equal(detailedState("failed", "FAILED", []), "failed");
    assert.equal(detailedState("failed", "CANCELLED", []), "failed");
  });

  test("hoàn tiền bị từ chối không được báo là đang hoàn", () => {
    const status = "PAYMENT_EXPIRED_REFUND_PENDING";
    assert.equal(
      detailedState("refund_pending", status, refunds("FAILED")),
      "refund_failed",
    );
    assert.equal(
      detailedState("refund_pending", status, refunds("PENDING")),
      "refund_pending",
    );
    // Lần thử sau đang chờ thì tiền vẫn đang được hoàn.
    assert.equal(
      detailedState("refund_pending", status, refunds("FAILED", "PENDING")),
      "refund_pending",
    );
    assert.equal(
      detailedState("success", "PAID", refunds("FAILED")),
      "success",
    );
  });
});
