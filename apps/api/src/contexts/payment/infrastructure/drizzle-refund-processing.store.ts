import { and, asc, eq, inArray, lte } from "drizzle-orm";
import {
  OrderStatus,
  OutboxStatus,
  RefundStatus,
  TransactionStatus,
} from "@tickethub/shared";
import { db } from "../../../database/db";
import {
  orders,
  outbox,
  refunds,
  transactions,
} from "../../../database/schema";
import type { RefundRequestedPayload } from "../domain/refund-processing";
import type {
  RefundOrderContext,
  RefundOutboxEvent,
  RefundProcessingStore,
} from "../domain/refund-processing.ports";

const EVENT_TYPE = "REFUND_REQUESTED";

export class DrizzleRefundProcessingStore implements RefundProcessingStore {
  findPending(limit: number, now: Date): Promise<RefundOutboxEvent[]> {
    return db
      .select({
        id: outbox.id,
        payload: outbox.payload,
        retryCount: outbox.retryCount,
      })
      .from(outbox)
      .where(
        and(
          eq(outbox.eventType, EVENT_TYPE),
          eq(outbox.status, OutboxStatus.PENDING),
          lte(outbox.nextRetryAt, now),
        ),
      )
      .orderBy(asc(outbox.createdAt))
      .limit(limit);
  }

  async claim(eventId: string, now: Date): Promise<boolean> {
    const [claimed] = await db
      .update(outbox)
      .set({ status: OutboxStatus.PROCESSING, updatedAt: now })
      .where(
        and(
          eq(outbox.id, eventId),
          eq(outbox.eventType, EVENT_TYPE),
          eq(outbox.status, OutboxStatus.PENDING),
          lte(outbox.nextRetryAt, now),
        ),
      )
      .returning({ id: outbox.id });
    return Boolean(claimed);
  }

  async loadContext(
    payload: RefundRequestedPayload,
  ): Promise<RefundOrderContext | null> {
    const [order] = await db
      .select({
        id: orders.id,
        orderCode: orders.orderCode,
        status: orders.status,
      })
      .from(orders)
      .where(eq(orders.id, payload.orderId))
      .limit(1);
    if (!order) return null;

    const [tx] = await db
      .select({
        transactionRef: transactions.transactionRef,
        providerTxNumber: transactions.providerTxNumber,
        createdAt: transactions.createdAt,
        rawCallback: transactions.rawCallback,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.orderId, payload.orderId),
          eq(transactions.status, TransactionStatus.SUCCESS),
        ),
      )
      .limit(1);
    if (!tx) return null;

    const pendingRefunds = await db
      .select({ id: refunds.id, amount: refunds.amount })
      .from(refunds)
      .where(
        and(
          inArray(refunds.id, payload.refundIds),
          eq(refunds.orderId, payload.orderId),
          eq(refunds.status, RefundStatus.PENDING),
        ),
      );

    return { order, transaction: tx, pendingRefunds };
  }

  async markRefundsProcessing(
    refundIds: string[],
    now: Date,
  ): Promise<boolean> {
    const updated = await db
      .update(refunds)
      .set({ status: RefundStatus.PROCESSING, updatedAt: now })
      .where(
        and(
          inArray(refunds.id, refundIds),
          eq(refunds.status, RefundStatus.PENDING),
        ),
      )
      .returning({ id: refunds.id });
    if (updated.length === refundIds.length) return true;
    // Khong hoan nguyen duoc mot phan: tra cac dong vua doi ve PENDING
    if (updated.length > 0) {
      await db
        .update(refunds)
        .set({ status: RefundStatus.PENDING, updatedAt: now })
        .where(
          inArray(
            refunds.id,
            updated.map((r) => r.id),
          ),
        );
    }
    return false;
  }

  async complete(input: {
    eventId: string;
    refundIds: string[];
    orderId: string;
    providerRefundRef: string;
    orderBecomesRefunded: boolean;
    now: Date;
  }): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(refunds)
        .set({
          status: RefundStatus.COMPLETED,
          providerRefundRef: input.providerRefundRef,
          processedAt: input.now,
          errorMessage: null,
          updatedAt: input.now,
        })
        .where(inArray(refunds.id, input.refundIds));
      if (input.orderBecomesRefunded) {
        await tx
          .update(orders)
          .set({ status: OrderStatus.REFUNDED, updatedAt: input.now })
          .where(
            and(
              eq(orders.id, input.orderId),
              eq(orders.status, OrderStatus.PAYMENT_EXPIRED_REFUND_PENDING),
            ),
          );
      }
      await tx
        .update(outbox)
        .set({
          status: OutboxStatus.COMPLETED,
          errorMessage: null,
          updatedAt: input.now,
        })
        .where(eq(outbox.id, input.eventId));
    });
  }

  async reject(input: {
    eventId: string;
    refundIds: string[];
    message: string;
    now: Date;
  }): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(refunds)
        .set({
          status: RefundStatus.FAILED,
          errorMessage: input.message,
          processedAt: input.now,
          updatedAt: input.now,
        })
        .where(inArray(refunds.id, input.refundIds));
      await tx
        .update(outbox)
        .set({
          status: OutboxStatus.FAILED,
          errorMessage: input.message,
          updatedAt: input.now,
        })
        .where(eq(outbox.id, input.eventId));
    });
  }

  async releaseForRetry(input: {
    eventId: string;
    refundIds: string[];
    retryCount: number;
    nextRetryAt: Date;
    giveUp: boolean;
    message: string;
    now: Date;
  }): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(refunds)
        .set({
          status: RefundStatus.PENDING,
          retryCount: input.retryCount,
          errorMessage: input.message,
          updatedAt: input.now,
        })
        .where(inArray(refunds.id, input.refundIds));
      await tx
        .update(outbox)
        .set({
          status: input.giveUp ? OutboxStatus.FAILED : OutboxStatus.PENDING,
          retryCount: input.retryCount,
          nextRetryAt: input.nextRetryAt,
          errorMessage: input.message,
          updatedAt: input.now,
        })
        .where(eq(outbox.id, input.eventId));
    });
  }

  async failEvent(eventId: string, message: string, now: Date): Promise<void> {
    await db
      .update(outbox)
      .set({
        status: OutboxStatus.FAILED,
        errorMessage: message,
        updatedAt: now,
      })
      .where(eq(outbox.id, eventId));
  }

  async annotateUncertain(
    eventId: string,
    message: string,
    now: Date,
  ): Promise<void> {
    await db
      .update(outbox)
      .set({ errorMessage: message, updatedAt: now })
      .where(eq(outbox.id, eventId));
  }
}
