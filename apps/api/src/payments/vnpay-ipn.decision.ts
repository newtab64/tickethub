import { OrderStatus, TransactionStatus } from "@tickethub/shared";

export type IpnDecision =
  | "INVALID_SIGNATURE"
  | "ORDER_NOT_FOUND"
  | "AMOUNT_MISMATCH"
  | "ALREADY_PROCESSED"
  | "APPLY_SUCCESS"
  | "RECORD_FAILURE"
  | "LATE_SUCCESS"
  | "MANUAL_REVIEW";

export interface IpnDecisionInput {
  signatureValid: boolean;
  transactionFound: boolean;
  amountMatches: boolean;
  orderStatus: OrderStatus | null;
  transactionStatus: TransactionStatus | null;
  paymentSuccessful: boolean;
  orderExpired: boolean;
}

export function decideVnpayIpn(input: IpnDecisionInput): IpnDecision {
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

  // Cung mot giao dich da hoan tat (PAID + SUCCESS).
  if (
    input.orderStatus === OrderStatus.PAID &&
    input.transactionStatus === TransactionStatus.SUCCESS
  ) {
    return "ALREADY_PROCESSED";
  }

  // Don da EXPIRED ma giao dich da SUCCESS: IPN muon da xu ly (refund tu dong).
  if (
    input.orderStatus === OrderStatus.EXPIRED &&
    input.transactionStatus === TransactionStatus.SUCCESS
  ) {
    return "ALREADY_PROCESSED";
  }

  // Don da duoc cleanup (EXPIRED), giao dich van PENDING:
  // thanh cong thi thu cap ve / refund; that bai thi ghi nhan va giai phong voucher.
  // Khong duoc tru/nhan kho lan hai neu da EXPIRED.
  if (
    input.orderStatus === OrderStatus.EXPIRED &&
    input.transactionStatus === TransactionStatus.PENDING
  ) {
    // Kho/ghế của EXPIRED đã được giải phóng bởi cleanup.
    // Với thất bại đã xác nhận, cập nhật DB mà KHÔNG giải phóng lần hai.
    return input.paymentSuccessful ? "LATE_SUCCESS" : "RECORD_FAILURE";
  }

  // Cac trang thai khong dong nhat can doi soat.
  if (
    input.orderStatus !== OrderStatus.PENDING ||
    input.transactionStatus !== TransactionStatus.PENDING
  ) {
    return "MANUAL_REVIEW";
  }

  // Don PENDING nhung da qua han (chua bi don).
  if (input.orderExpired) {
    return input.paymentSuccessful ? "LATE_SUCCESS" : "RECORD_FAILURE";
  }

  return input.paymentSuccessful ? "APPLY_SUCCESS" : "RECORD_FAILURE";
}
