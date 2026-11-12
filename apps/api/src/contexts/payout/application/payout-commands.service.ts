import type { Payout } from "../domain/payout.models";
import {
  assertNotPaidOutForGeneration,
  assertRecalculable,
  computePayoutAmounts,
} from "../domain/payout-rules";
import { payoutErrors } from "../domain/payout.errors";
import type { PayoutRepository } from "../domain/payout.ports";

/** Lenh ghi cua Quan tri vien tren lenh quyet toan. */
export class PayoutCommands {
  constructor(private readonly payouts: PayoutRepository) {}

  /** Tinh doanh thu su kien va tao moi hoac cap nhat lenh quyet toan. */
  async generatePayout(eventId: string, _adminUserId: string): Promise<Payout> {
    const event = await this.payouts.findEvent(eventId);
    if (!event) throw payoutErrors.eventNotFound();

    const existing = await this.payouts.findByEventId(eventId);
    assertNotPaidOutForGeneration(existing);

    const gross = await this.payouts.sumGrossRevenue(eventId);
    const refunded = await this.payouts.sumRefundedAmount(eventId);
    const amounts = computePayoutAmounts(gross, refunded);

    return existing
      ? this.payouts.updateAmounts(existing.id, amounts)
      : this.payouts.createPending(event, amounts);
  }

  async approvePayout(
    payoutId: string,
    adminUserId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const result = await this.payouts.approve(
      payoutId,
      adminUserId,
      new Date(),
      { ipAddress, userAgent },
    );
    if (result.outcome === "NOT_FOUND") throw payoutErrors.payoutNotFound();
    if (result.outcome === "ALREADY_PAID_OUT") {
      throw payoutErrors.alreadyApproved();
    }
    return {
      ...result.payout,
      message: "Lệnh chi trả đã được phê duyệt thành công.",
    };
  }

  async holdPayout(
    payoutId: string,
    reason: string,
    adminUserId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Payout> {
    const result = await this.payouts.hold(
      payoutId,
      reason,
      adminUserId,
      new Date(),
      { ipAddress, userAgent },
    );
    if (result.outcome === "NOT_FOUND") throw payoutErrors.payoutNotFound();
    if (result.outcome === "ALREADY_PAID_OUT")
      throw payoutErrors.cannotHoldPaid();
    return result.payout;
  }

  /** Tinh lai so lieu cho lenh dang PENDING hoac HOLD. */
  async recalculatePayout(
    payoutId: string,
    adminUserId: string,
  ): Promise<Payout> {
    const payout = await this.payouts.findById(payoutId);
    if (!payout) throw payoutErrors.payoutNotFound();
    assertRecalculable(payout);
    return this.generatePayout(payout.eventId, adminUserId);
  }
}
