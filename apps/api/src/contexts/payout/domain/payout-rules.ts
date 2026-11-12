import { PayoutStatus } from "@tickethub/shared";
import { calculatePayout } from "./payout-calculator";
import { payoutErrors } from "./payout.errors";
import type { Payout, PayoutAmounts } from "./payout.models";

/** Lenh da PAID_OUT thi khong duoc tinh lai hay ghi de. */
export function assertNotPaidOutForGeneration(existing: Payout | null): void {
  if (existing && existing.status === PayoutStatus.PAID_OUT) {
    throw payoutErrors.eventPayoutAlreadyPaid();
  }
}

export function assertRecalculable(payout: Payout): void {
  if (payout.status === PayoutStatus.PAID_OUT) {
    throw payoutErrors.cannotRecalculatePaid();
  }
}

/** Phan bo tai chinh tu tong doanh thu gop va tong tien hoan. */
export function computePayoutAmounts(
  grossRevenue: number,
  refundDeduction: number,
): PayoutAmounts {
  const c = calculatePayout(grossRevenue, refundDeduction);
  return {
    grossRevenue: c.grossRevenue,
    refundDeduction: c.refundDeduction,
    platformFee: c.platformFee,
    gatewayFee: c.gatewayFee,
    netPayout: c.netPayout,
  };
}
