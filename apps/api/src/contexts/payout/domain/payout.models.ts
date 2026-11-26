import type {
  OrganizerPayoutQueryDto,
  PayoutFilterQueryDto,
  PayoutStatus,
  ReconciliationQueryDto,
  ReconciliationStatus,
} from "@tickethub/shared";

export type {
  OrganizerPayoutQueryDto,
  PayoutFilterQueryDto,
  ReconciliationQueryDto,
};

/** Lenh quyet toan cho mot su kien; so tien da o dang so. */
export interface Payout {
  id: string;
  organizerId: string;
  eventId: string;
  totalRevenue: number;
  platformFee: number;
  gatewayFee: number;
  refundDeduction: number;
  netPayout: number;
  status: PayoutStatus;
  holdReason: string | null;
  paidOutAt: Date | null;
  approvedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayoutEventRef {
  id: string;
  organizerId: string;
  title: string;
}

export interface PayoutAmounts {
  grossRevenue: number;
  refundDeduction: number;
  platformFee: number;
  gatewayFee: number;
  netPayout: number;
}

export interface AuditMeta {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export type PayoutTransitionResult =
  | { outcome: "UPDATED"; payout: Payout }
  | { outcome: "NOT_FOUND" }
  | { outcome: "ALREADY_PAID_OUT" };

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Paged<T> {
  items: T[];
  meta: PageMeta;
}

/** Dong danh sach quyet toan (so tien la so thuc, giong API cong bo). */
export type PayoutListRow = Record<string, unknown> & { id: string };

export interface ReconciliationOrder {
  id: string;
  orderCode: string;
  eventId: string;
  eventTitle: string;
  status: string;
  finalAmount: number;
}

export interface ReconciliationTransaction {
  id: string;
  orderId: string | null;
  status: string;
  amount: number;
  transactionRef: string;
  providerTxNumber: string | null;
  bankCode: string | null;
  payDate: Date | null;
}

export interface ReconciliationRefund {
  orderId: string;
  amount: number;
}

export interface ReconciliationItem {
  orderId: string | null;
  orderCode: string | null;
  eventId: string | null;
  eventTitle: string | null;
  orderAmount: number;
  paidAmount: number;
  refundedAmount: number;
  transactionRef: string | null;
  providerTxNumber: string | null;
  bankCode: string | null;
  payDate: Date | null;
  reconciliationStatus: ReconciliationStatus;
}

export interface ReconciliationSummary {
  totalTransactions: number;
  totalOrderAmount: number;
  totalPaidAmount: number;
  totalRefundedAmount: number;
  matchedCount: number;
  mismatchedCount: number;
}

export interface ReconciliationReport {
  summary: ReconciliationSummary;
  items: ReconciliationItem[];
  meta: PageMeta;
}
