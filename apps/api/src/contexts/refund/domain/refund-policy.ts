import { RefundPolicyType } from "@tickethub/shared";

/**
 * Tính phần trăm hoàn tiền dựa vào chính sách và thời gian trước sự kiện
 */
export function computeRefundPercentage(
  policyType: RefundPolicyType,
  startTime: Date,
  now: Date = new Date(),
): number {
  if (policyType === RefundPolicyType.NO_REFUND) {
    return 0;
  }

  const diffMs = startTime.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (policyType === RefundPolicyType.FLEXIBLE) {
    if (diffDays >= 7) return 100;
    if (diffDays >= 3) return 50;
    return 0;
  }

  if (policyType === RefundPolicyType.STRICT) {
    if (diffDays >= 14) return 50;
    return 0;
  }

  // CUSTOM hoặc fallback
  return 0;
}

/**
 * Tính số ngày còn lại đến sự kiện
 */
export function computeDaysUntilEvent(
  startTime: Date,
  now: Date = new Date(),
): number {
  const diffMs = startTime.getTime() - now.getTime();
  const days = diffMs / (1000 * 60 * 60 * 24);
  return Number(days.toFixed(1));
}
