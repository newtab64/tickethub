import type {
  AuditMeta,
  Paged,
  Payout,
  PayoutAmounts,
  PayoutEventRef,
  PayoutFilterQueryDto,
  PayoutListRow,
  PayoutTransitionResult,
  ReconciliationOrder,
  ReconciliationRefund,
  ReconciliationTransaction,
} from "./payout.models";

export interface PayoutRepository {
  findEvent(eventId: string): Promise<PayoutEventRef | null>;
  findByEventId(eventId: string): Promise<Payout | null>;
  findById(payoutId: string): Promise<Payout | null>;
  /** Tong finalAmount cua don PAID va REFUNDED cua su kien. */
  sumGrossRevenue(eventId: string): Promise<number>;
  /** Tong tien hoan o trang thai PENDING hoac COMPLETED cua su kien. */
  sumRefundedAmount(eventId: string): Promise<number>;
  createPending(event: PayoutEventRef, amounts: PayoutAmounts): Promise<Payout>;
  updateAmounts(payoutId: string, amounts: PayoutAmounts): Promise<Payout>;
  /** Cap nhat nguyen tu (chi khi chua PAID_OUT) kem audit log trong mot transaction. */
  approve(
    payoutId: string,
    adminUserId: string,
    now: Date,
    meta: AuditMeta,
  ): Promise<PayoutTransitionResult>;
  hold(
    payoutId: string,
    reason: string,
    adminUserId: string,
    now: Date,
    meta: AuditMeta,
  ): Promise<PayoutTransitionResult>;
}

export interface PayoutQueryPort {
  findOrganizerProfileId(userId: string): Promise<string | null>;
  listForAdmin(
    query: PayoutFilterQueryDto,
    page: number,
    limit: number,
  ): Promise<Paged<PayoutListRow>>;
  listForOrganizer(
    profileId: string,
    page: number,
    limit: number,
  ): Promise<Paged<PayoutListRow>>;
}

export interface ReconciliationReader {
  listOrders(eventId?: string): Promise<ReconciliationOrder[]>;
  listVnpayTransactions(
    orderIds?: string[],
  ): Promise<ReconciliationTransaction[]>;
  listActiveRefunds(orderIds?: string[]): Promise<ReconciliationRefund[]>;
}
