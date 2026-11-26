import { ReconciliationStatus } from "@tickethub/shared";
import type {
  ReconciliationItem,
  ReconciliationOrder,
  ReconciliationRefund,
  ReconciliationReport,
  ReconciliationSummary,
  ReconciliationTransaction,
} from "./payout.models";

export interface ReconcileInput {
  orders: ReconciliationOrder[];
  /** Giao dich VNPay, moi nhat truoc. */
  transactions: ReconciliationTransaction[];
  refunds: ReconciliationRefund[];
  /** Co loc theo mot su kien cu the hay doi soat toan he thong. */
  scopedToEvent: boolean;
  status?: string | undefined;
  page: number;
  limit: number;
}

function classify(
  orderAmount: number,
  tx: ReconciliationTransaction | undefined,
): ReconciliationStatus {
  if (!tx || tx.status !== "SUCCESS") {
    return ReconciliationStatus.MISSING_TRANSACTION;
  }
  return orderAmount === Number(tx.amount || 0)
    ? ReconciliationStatus.MATCHED
    : ReconciliationStatus.AMOUNT_MISMATCH;
}

export function summarize(items: ReconciliationItem[]): ReconciliationSummary {
  return {
    totalTransactions: items.length,
    totalOrderAmount: items.reduce((sum, i) => sum + i.orderAmount, 0),
    totalPaidAmount: items.reduce((sum, i) => sum + i.paidAmount, 0),
    totalRefundedAmount: items.reduce((sum, i) => sum + i.refundedAmount, 0),
    matchedCount: items.filter(
      (i) => i.reconciliationStatus === ReconciliationStatus.MATCHED,
    ).length,
    mismatchedCount: items.filter(
      (i) => i.reconciliationStatus !== ReconciliationStatus.MATCHED,
    ).length,
  };
}

/**
 * Doi soat don hang voi giao dich VNPay: MATCHED, AMOUNT_MISMATCH,
 * MISSING_TRANSACTION va (chi khi doi soat toan he thong) ORPHAN_TRANSACTION.
 */
export function reconcile(input: ReconcileInput): ReconciliationReport {
  const { orders, transactions, refunds, scopedToEvent, page, limit } = input;

  const refundByOrder = new Map<string, number>();
  for (const r of refunds) {
    refundByOrder.set(
      r.orderId,
      (refundByOrder.get(r.orderId) ?? 0) + r.amount,
    );
  }

  // Uu tien giao dich SUCCESS cho moi don hang
  const txByOrder = new Map<string, ReconciliationTransaction>();
  for (const tx of transactions) {
    if (tx.orderId && (!txByOrder.has(tx.orderId) || tx.status === "SUCCESS")) {
      txByOrder.set(tx.orderId, tx);
    }
  }

  const matchedTxIds = new Set<string>();
  const items: ReconciliationItem[] = [];

  for (const order of orders) {
    const tx = txByOrder.get(order.id);
    if (tx) matchedTxIds.add(tx.id);

    if (order.status !== "PAID" && order.status !== "REFUNDED" && !tx) continue;

    const orderAmount = order.finalAmount;
    items.push({
      orderId: order.id,
      orderCode: order.orderCode,
      eventId: order.eventId,
      eventTitle: order.eventTitle,
      orderAmount,
      paidAmount: tx && tx.status === "SUCCESS" ? Number(tx.amount || 0) : 0,
      refundedAmount: refundByOrder.get(order.id) ?? 0,
      transactionRef: tx?.transactionRef ?? null,
      providerTxNumber: tx?.providerTxNumber ?? null,
      bankCode: tx?.bankCode ?? null,
      payDate: tx?.payDate ?? null,
      reconciliationStatus: classify(orderAmount, tx),
    });
  }

  if (!scopedToEvent) {
    for (const tx of transactions) {
      if (!matchedTxIds.has(tx.id) && tx.status === "SUCCESS") {
        items.push({
          orderId: tx.orderId ?? null,
          orderCode: null,
          eventId: null,
          eventTitle: null,
          orderAmount: 0,
          paidAmount: Number(tx.amount || 0),
          refundedAmount: 0,
          transactionRef: tx.transactionRef,
          providerTxNumber: tx.providerTxNumber ?? null,
          bankCode: tx.bankCode ?? null,
          payDate: tx.payDate ?? null,
          reconciliationStatus: ReconciliationStatus.ORPHAN_TRANSACTION,
        });
      }
    }
  }

  const filtered =
    input.status && input.status !== "ALL"
      ? items.filter((i) => i.reconciliationStatus === input.status)
      : items;

  const total = filtered.length;
  const offset = (page - 1) * limit;
  return {
    summary: summarize(items),
    items: filtered.slice(offset, offset + limit),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
  };
}
