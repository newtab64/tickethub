import { RefundStatus } from "@tickethub/shared";

export type RefundAction =
  "CLAIM" | "CONFIRM_SUCCESS" | "CONFIRM_FAILURE" | "RESULT_UNKNOWN";

export type RefundTransition =
  | {
      allowed: true;
      nextStatus: RefundStatus;
      changed: boolean;
    }
  | {
      allowed: false;
      reason: "INVALID_TRANSITION";
    };

export function transitionRefund(
  current: RefundStatus,
  action: RefundAction,
): RefundTransition {
  // 1. Worker nhan yeu cau cho xu ly
  if (current === RefundStatus.PENDING && action === "CLAIM") {
    return {
      allowed: true,
      nextStatus: RefundStatus.PROCESSING,
      changed: true,
    };
  }

  // 2. Hoan tien thanh cong da duoc xac minh
  if (current === RefundStatus.PROCESSING && action === "CONFIRM_SUCCESS") {
    return {
      allowed: true,
      nextStatus: RefundStatus.COMPLETED,
      changed: true,
    };
  }

  // 3. Hoan tien that bai CUOI CUNG
  if (current === RefundStatus.PROCESSING && action === "CONFIRM_FAILURE") {
    return {
      allowed: true,
      nextStatus: RefundStatus.FAILED,
      changed: true,
    };
  }

  // 4. Timeout hoac chua ro ket qua
  if (current === RefundStatus.PROCESSING && action === "RESULT_UNKNOWN") {
    return {
      allowed: true,
      nextStatus: RefundStatus.PROCESSING,
      changed: false,
    };
  }

  // 5. Ket qua cuoi cung duoc gui lap lai
  if (
    (current === RefundStatus.COMPLETED && action === "CONFIRM_SUCCESS") ||
    (current === RefundStatus.FAILED && action === "CONFIRM_FAILURE")
  ) {
    return {
      allowed: true,
      nextStatus: current,
      changed: false,
    };
  }

  // 6. Cam moi chuyen trang thai khong hop le
  return {
    allowed: false,
    reason: "INVALID_TRANSITION",
  };
}
