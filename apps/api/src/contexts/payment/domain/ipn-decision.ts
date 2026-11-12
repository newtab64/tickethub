import { OrderStatus, TransactionStatus } from "@tickethub/shared";

/** Ket qua cuoi cung tra ve cho VNPay (qua toViVnpayResponse). */
export type IpnDecision =
  | "INVALID_SIGNATURE"
  | "ORDER_NOT_FOUND"
  | "AMOUNT_MISMATCH"
  | "ALREADY_PROCESSED"
  | "APPLY_SUCCESS"
  | "RECORD_FAILURE"
  | "LATE_RESTORED"
  | "LATE_REFUND_PENDING"
  | "MANUAL_REVIEW";

/** Quyet dinh ban dau: them LATE_PAYMENT, duoc use case chuyen thanh LATE_RESTORED hoac LATE_REFUND_PENDING. */
export type IpnVerdict =
  | Exclude<IpnDecision, "LATE_RESTORED" | "LATE_REFUND_PENDING">
  | "LATE_PAYMENT";

export interface IpnDecisionInput {
  signatureValid: boolean;
  transactionFound: boolean;
  amountMatches: boolean;
  orderStatus: OrderStatus | null;
  transactionStatus: TransactionStatus | null;
  paymentSuccessful: boolean;
  orderExpired: boolean;
}

/** Don da duoc xu ly ket thuc (da thanh toan, dang cho hoan hoac da hoan tien). */
const SETTLED_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.PAYMENT_EXPIRED_REFUND_PENDING,
  OrderStatus.REFUNDED,
];

/** Don khong con giu cho: da het han, bi huy, hoac con PENDING nhung da qua han giu. */
function isLapsedOrder(input: IpnDecisionInput): boolean {
  return (
    input.orderStatus === OrderStatus.EXPIRED ||
    input.orderStatus === OrderStatus.CANCELLED ||
    (input.orderStatus === OrderStatus.PENDING && input.orderExpired)
  );
}

export function decideVnpayIpn(input: IpnDecisionInput): IpnVerdict {
  // Không tin bất kỳ dữ liệu nào khi chữ ký không hợp lệ.
  if (!input.signatureValid) {
    return "INVALID_SIGNATURE";
  }

  // Transaction phải được tạo từ Backend trước thanh toán.
  if (!input.transactionFound) {
    return "ORDER_NOT_FOUND";
  }

  // Amount phải được đối chiếu với PostgreSQL.
  if (!input.amountMatches) {
    return "AMOUNT_MISMATCH";
  }

  if (!input.orderStatus || !input.transactionStatus) {
    return "MANUAL_REVIEW";
  }

  // Cùng một giao dịch đã hoàn tất (kể cả đã xử lý thanh toán muộn):
  // tuyệt đối không cập nhật hay cấp vé thêm lần nữa.
  if (
    input.transactionStatus === TransactionStatus.SUCCESS &&
    SETTLED_ORDER_STATUSES.includes(input.orderStatus)
  ) {
    return "ALREADY_PROCESSED";
  }

  // Thanh toán thành công nhưng đơn không còn giữ chỗ: phải khôi phục vé hoặc hoàn tiền,
  // không bao giờ để khách bị trừ tiền mà không có vé và không được hoàn tiền.
  if (
    input.transactionStatus === TransactionStatus.PENDING &&
    isLapsedOrder(input)
  ) {
    return input.paymentSuccessful ? "LATE_PAYMENT" : "MANUAL_REVIEW";
  }

  // Các trạng thái không đồng nhất cần đối soát.
  if (
    input.orderStatus !== OrderStatus.PENDING ||
    input.transactionStatus !== TransactionStatus.PENDING
  ) {
    return "MANUAL_REVIEW";
  }

  return input.paymentSuccessful ? "APPLY_SUCCESS" : "RECORD_FAILURE";
}
