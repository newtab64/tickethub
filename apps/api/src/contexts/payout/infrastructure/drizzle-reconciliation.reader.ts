import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../../database/db";
import { events } from "../../../database/schema/events";
import { orders } from "../../../database/schema/orders";
import { refunds } from "../../../database/schema/refunds";
import { transactions } from "../../../database/schema/transactions";
import type {
  ReconciliationOrder,
  ReconciliationRefund,
  ReconciliationTransaction,
} from "../domain/payout.models";
import type { ReconciliationReader } from "../domain/payout.ports";

export class DrizzleReconciliationReader implements ReconciliationReader {
  async listOrders(eventId?: string): Promise<ReconciliationOrder[]> {
    const rows = await db
      .select({
        id: orders.id,
        orderCode: orders.orderCode,
        eventId: orders.eventId,
        eventTitle: events.title,
        status: orders.status,
        finalAmount: orders.finalAmount,
      })
      .from(orders)
      .innerJoin(events, eq(orders.eventId, events.id))
      .where(eventId ? eq(orders.eventId, eventId) : undefined)
      .orderBy(desc(orders.createdAt));
    return rows.map((r) => ({ ...r, finalAmount: Number(r.finalAmount || 0) }));
  }

  async listVnpayTransactions(
    orderIds?: string[],
  ): Promise<ReconciliationTransaction[]> {
    const where = orderIds
      ? and(
          eq(transactions.provider, "VNPAY"),
          inArray(transactions.orderId, orderIds),
        )
      : eq(transactions.provider, "VNPAY");
    const rows = await db
      .select()
      .from(transactions)
      .where(where)
      .orderBy(desc(transactions.createdAt));
    return rows.map((tx) => ({
      id: tx.id,
      orderId: tx.orderId ?? null,
      status: tx.status,
      amount: Number(tx.amount || 0),
      transactionRef: tx.transactionRef,
      providerTxNumber: tx.providerTxNumber ?? null,
      bankCode: tx.bankCode ?? null,
      payDate: tx.payDate ?? null,
    }));
  }

  async listActiveRefunds(
    orderIds?: string[],
  ): Promise<ReconciliationRefund[]> {
    const conditions = [inArray(refunds.status, ["PENDING", "COMPLETED"])];
    if (orderIds) conditions.push(inArray(refunds.orderId, orderIds));
    const rows = await db
      .select({ orderId: refunds.orderId, amount: refunds.amount })
      .from(refunds)
      .where(and(...conditions));
    return rows.map((r) => ({
      orderId: r.orderId,
      amount: Number(r.amount || 0),
    }));
  }
}
