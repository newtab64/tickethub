import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ReconciliationStatus } from "@tickethub/shared";
import { reconcile } from "../src/contexts/payout/domain/reconciliation";
import type {
  ReconciliationOrder,
  ReconciliationTransaction,
} from "../src/contexts/payout/domain/payout.models";

const order = (
  id: string,
  amount: number,
  status = "PAID",
): ReconciliationOrder => ({
  id,
  orderCode: `C-${id}`,
  eventId: "e1",
  eventTitle: "E",
  status,
  finalAmount: amount,
});

const tx = (
  id: string,
  orderId: string | null,
  amount: number,
  status = "SUCCESS",
): ReconciliationTransaction => ({
  id,
  orderId,
  status,
  amount,
  transactionRef: `T-${id}`,
  providerTxNumber: null,
  bankCode: null,
  payDate: null,
});

const base = { refunds: [], scopedToEvent: false, page: 1, limit: 20 };

describe("reconcile", () => {
  it("classifies matched, mismatched, missing and orphan records", () => {
    const report = reconcile({
      ...base,
      orders: [
        order("a", 100),
        order("b", 200),
        order("c", 300),
        order("d", 50, "PENDING"),
      ],
      transactions: [
        tx("t1", "a", 100),
        tx("t2", "b", 150),
        tx("t9", null, 70),
      ],
    });
    const byOrder = new Map(
      report.items.map((i) => [i.orderId ?? i.transactionRef, i]),
    );
    assert.equal(
      byOrder.get("a")?.reconciliationStatus,
      ReconciliationStatus.MATCHED,
    );
    assert.equal(
      byOrder.get("b")?.reconciliationStatus,
      ReconciliationStatus.AMOUNT_MISMATCH,
    );
    assert.equal(
      byOrder.get("c")?.reconciliationStatus,
      ReconciliationStatus.MISSING_TRANSACTION,
    );
    assert.equal(
      byOrder.get("T-t9")?.reconciliationStatus,
      ReconciliationStatus.ORPHAN_TRANSACTION,
    );
    assert.equal(byOrder.has("d"), false); // PENDING khong co giao dich thi bo qua
    assert.equal(report.summary.matchedCount, 1);
    assert.equal(report.summary.mismatchedCount, 3);
  });

  it("does not report orphans when scoped to one event", () => {
    const report = reconcile({
      ...base,
      scopedToEvent: true,
      orders: [order("a", 100)],
      transactions: [tx("t1", "a", 100), tx("t9", null, 70)],
    });
    assert.equal(report.items.length, 1);
  });

  it("sums refunds per order and prefers the SUCCESS transaction", () => {
    const report = reconcile({
      ...base,
      orders: [order("a", 100, "REFUNDED")],
      transactions: [
        tx("t1", "a", 100, "FAILED"),
        tx("t2", "a", 100, "SUCCESS"),
      ],
      refunds: [
        { orderId: "a", amount: 30 },
        { orderId: "a", amount: 20 },
      ],
    });
    assert.equal(report.items[0]?.refundedAmount, 50);
    assert.equal(report.items[0]?.transactionRef, "T-t2");
    assert.equal(
      report.items[0]?.reconciliationStatus,
      ReconciliationStatus.MATCHED,
    );
  });

  it("filters by status, keeps summary over all items, and paginates", () => {
    const orders = [order("a", 1), order("b", 2), order("c", 3)];
    const report = reconcile({
      ...base,
      orders,
      transactions: [tx("t1", "a", 1)],
      status: ReconciliationStatus.MISSING_TRANSACTION,
      limit: 1,
    });
    assert.equal(report.meta.total, 2);
    assert.equal(report.meta.totalPages, 2);
    assert.equal(report.items.length, 1);
    assert.equal(report.summary.totalTransactions, 3);
  });

  it("returns an empty single page when there is nothing to reconcile", () => {
    const report = reconcile({ ...base, orders: [], transactions: [] });
    assert.deepEqual(report.meta, {
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
  });
});
