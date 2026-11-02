import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";

import {
  EventStatus,
  OrderStatus,
  TransactionStatus,
  PaymentProvider,
  OutboxStatus,
  RefundStatus,
  SeatStatus,
  TicketStatus,
} from "@tickethub/shared";

import { db } from "../database/db";
import {
  orders,
  transactions,
  orderItems,
  ticketTypes,
  seats,
  outbox,
  tickets,
  auditLog,
  events,
  refunds,
  voucherRedemptions,
} from "../database/schema";

import { EventReadCacheService } from "../events/event-read-cache.service";
import { toVnpayAmount } from "./vnpay-amount";
import { decideVnpayIpn, type IpnDecision } from "./vnpay-ipn.decision";
import type { VerifiedPaymentResult } from "./payment-settlement.types";
import { LATE_REFUND_REASON } from "./refund-reasons";

type SettleOutcome = { decision: IpnDecision; eventId: string | null };
type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type OrderRow = typeof orders.$inferSelect;
type OrderItemRow = typeof orderItems.$inferSelect;

const MANUAL_REVIEW_ACTIONS = [
  "VNPAY_IPN_MANUAL_REVIEW",
  "VNPAY_QUERYDR_MANUAL_REVIEW",
];

@Injectable()
export class PaymentSettlementService {
  private readonly logger = new Logger(PaymentSettlementService.name);

  constructor(
    @Inject(EventReadCacheService)
    private readonly eventReadCacheService: EventReadCacheService,
  ) {}

  /**
   * Ap ket qua thanh toan da xac minh vao Order/Transaction.
   * Dung chung cho IPN va QueryDR. Chu ky phai duoc xac minh truoc khi goi.
   */
  async settle(evidence: VerifiedPaymentResult): Promise<IpnDecision> {
    // Phan A: tim transaction do Backend da tao
    const existing = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.transactionRef, evidence.transactionRef),
        eq(transactions.provider, PaymentProvider.VNPAY),
      ),
    });

    if (!existing) {
      return "ORDER_NOT_FOUND";
    }

    // Phan B den D: toan bo thay doi nam trong mot DB transaction
    const { decision, eventId } = await db.transaction(
      async (tx): Promise<SettleOutcome> => {
        // Phan B: khoa order truoc, transaction sau (cung thu tu voi Booking Cleanup)
        const [order] = await tx
          .select()
          .from(orders)
          .where(eq(orders.id, existing.orderId))
          .for("update");

        if (!order) {
          return { decision: "ORDER_NOT_FOUND", eventId: null };
        }

        const [transaction] = await tx
          .select()
          .from(transactions)
          .where(eq(transactions.id, existing.id))
          .for("update");

        if (!transaction || transaction.orderId !== order.id) {
          return { decision: "MANUAL_REVIEW", eventId: null };
        }

        // Phan C: kiem tra tien va trang thai
        const callbackAmount = evidence.amountMinor;
        const transactionAmount = toVnpayAmount(transaction.amount);
        const orderAmount = toVnpayAmount(order.finalAmount);

        const amountMatches =
          transactionAmount !== null &&
          orderAmount !== null &&
          callbackAmount === transactionAmount &&
          callbackAmount === orderAmount;

        // Ket qua that bai da duoc ghi nhan truoc do
        if (
          amountMatches &&
          transaction.status === TransactionStatus.FAILED &&
          order.status === OrderStatus.FAILED &&
          evidence.outcome === "FAILURE"
        ) {
          return { decision: "ALREADY_PROCESSED", eventId: null };
        }

        const now = new Date();

        const initial = decideVnpayIpn({
          signatureValid: true,
          transactionFound: true,
          amountMatches,
          orderStatus: order.status,
          transactionStatus: transaction.status,
          paymentSuccessful: evidence.outcome === "SUCCESS",
          orderExpired: now >= order.expiresAt,
        });

        // Moi quyet dinh khac APPLY_SUCCESS / RECORD_FAILURE / LATE_SUCCESS
        // KHONG duoc cham vao ghe, kho ve hay trang thai don.
        if (
          initial !== "APPLY_SUCCESS" &&
          initial !== "RECORD_FAILURE" &&
          initial !== "LATE_SUCCESS"
        ) {
          // Khach da tra tien thanh cong nhung khong the xac nhan don: ghi de doi soat.
          if (
            initial === "MANUAL_REVIEW" &&
            evidence.outcome === "SUCCESS" &&
            amountMatches
          ) {
            // Order va transaction da khoa FOR UPDATE nen khong ghi trung.
            const [existingAudit] = await tx
              .select({ id: auditLog.id })
              .from(auditLog)
              .where(
                and(
                  inArray(auditLog.action, MANUAL_REVIEW_ACTIONS),
                  eq(auditLog.targetType, "TRANSACTION"),
                  eq(auditLog.targetId, transaction.id),
                ),
              )
              .limit(1);

            if (!existingAudit) {
              await tx
                .update(transactions)
                .set({
                  rawCallback: evidence.rawEvidence,
                  responseCode: evidence.responseCode,
                  providerTxNumber: evidence.providerTransactionId,
                  updatedAt: now,
                })
                .where(eq(transactions.id, transaction.id));

              await tx.insert(auditLog).values({
                actorRole: "SYSTEM",
                action:
                  evidence.source === "IPN"
                    ? "VNPAY_IPN_MANUAL_REVIEW"
                    : "VNPAY_QUERYDR_MANUAL_REVIEW",
                targetType: "TRANSACTION",
                targetId: transaction.id,
                changes: {
                  source: evidence.source,
                  orderId: order.id,
                  orderCode: order.orderCode,
                  orderStatus: order.status,
                  transactionStatus: transaction.status,
                  reason: "SUCCESS_CALLBACK_REQUIRES_REVIEW",
                  callback: evidence.rawEvidence,
                  recordedAt: now.toISOString(),
                },
              });
            }
          }

          return { decision: initial, eventId: null };
        }

        // Phan D: cap nhat ghe, ton kho, giao dich, order, ve
        const items = await tx
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, order.id));

        if (items.length === 0) {
          return { decision: "MANUAL_REVIEW", eventId: null };
        }

        // Mot ghe co so chi tuong ung voi mot ve.
        const seatedIds = items.flatMap((item) =>
          item.seatId === null ? [] : [item.seatId],
        );

        if (
          items.some(
            (item) =>
              item.quantity <= 0 ||
              (item.seatId !== null && item.quantity !== 1),
          ) ||
          new Set(seatedIds).size !== seatedIds.length
        ) {
          return { decision: "MANUAL_REVIEW", eventId: null };
        }

        // IPN muon: thu giu lai ghe/ve. Chi cap ve khi TAT CA con dung duoc.
        const lateIssued =
          initial === "LATE_SUCCESS" &&
          (await this.tryClaimLateInventory(tx, order, items, now));
        const lateRefund = initial === "LATE_SUCCESS" && !lateIssued;

        const paid = initial === "APPLY_SUCCESS" || lateIssued;
        const sellInventory = initial === "APPLY_SUCCESS";

        // Don PENDING qua han chua bi don: ghe/kho van dang bi giu, phai nha ra.
        // EXPIRED đã được Booking Cleanup trả tồn kho. Không trừ heldCount
        // hay giải phóng ghế lần thứ hai khi QueryDR xác nhận thất bại.
        const releaseInventory =
          (initial === "RECORD_FAILURE" &&
            order.status === OrderStatus.PENDING) ||
          (lateRefund && order.status === OrderStatus.PENDING);

        if (sellInventory || releaseInventory) {
          for (const item of items) {
            if (item.seatId !== null) {
              const updatedSeats = await tx
                .update(seats)
                .set({
                  status: sellInventory
                    ? SeatStatus.SOLD
                    : SeatStatus.AVAILABLE,
                  holdOrderId: null,
                  holdExpiresAt: null,
                  version: sql`${seats.version} + 1`,
                  updatedAt: now,
                })
                .where(
                  and(
                    eq(seats.id, item.seatId),
                    eq(seats.eventId, order.eventId),
                    eq(seats.ticketTypeId, item.ticketTypeId),
                    eq(seats.status, SeatStatus.HELD),
                    eq(seats.holdOrderId, order.id),
                    ...(sellInventory ? [gte(seats.holdExpiresAt, now)] : []),
                  ),
                )
                .returning({ id: seats.id });

              if (updatedSeats.length !== 1) {
                throw new Error(
                  "VNPAY_SEAT_CONFLICT: seat reservation is no longer valid",
                );
              }

              continue;
            }

            const updated = await tx
              .update(ticketTypes)
              .set({
                heldCount: sql`${ticketTypes.heldCount} - ${item.quantity}`,
                ...(sellInventory
                  ? {
                      soldCount: sql`${ticketTypes.soldCount} + ${item.quantity}`,
                    }
                  : {}),
                updatedAt: now,
              })
              .where(
                and(
                  eq(ticketTypes.id, item.ticketTypeId),
                  eq(ticketTypes.eventId, order.eventId),
                  eq(ticketTypes.isSeated, false),
                  gte(ticketTypes.heldCount, item.quantity),
                ),
              )
              .returning({ id: ticketTypes.id });

            // Rollback toan bo neu du lieu kho ve bat nhat
            if (updated.length !== 1) {
              throw new Error(
                "VNPAY_INVENTORY_CONFLICT: manual reconciliation required",
              );
            }
          }
        }

        await tx
          .update(transactions)
          .set({
            // Thanh toan muon het ghe: tien da thu that nen van la SUCCESS.
            status:
              paid || lateRefund
                ? TransactionStatus.SUCCESS
                : TransactionStatus.FAILED,
            responseCode: evidence.responseCode,
            providerTxNumber: evidence.providerTransactionId,
            bankCode: evidence.bankCode,
            rawCallback: evidence.rawEvidence,
            updatedAt: now,
          })
          .where(eq(transactions.id, transaction.id));

        await tx
          .update(orders)
          .set({
            status: paid
              ? OrderStatus.PAID
              : lateRefund
                ? OrderStatus.EXPIRED
                : OrderStatus.FAILED,
            paidAt: paid ? now : null,
            updatedAt: now,
          })
          .where(eq(orders.id, order.id));

        // Đồng bộ voucher trong cùng transaction với cập nhật đơn/giao dịch.
        // Thanh toán muộn không còn ghế (lateRefund) vẫn giữ RESERVED
        // tới khi refund được xác nhận hoàn tất.
        if (paid || initial === "RECORD_FAILURE") {
          await tx
            .update(voucherRedemptions)
            .set({ status: paid ? "REDEEMED" : "RELEASED" })
            .where(
              and(
                eq(voucherRedemptions.orderId, order.id),
                eq(voucherRedemptions.status, "RESERVED"),
              ),
            );
        }

        // Phat hanh ve va ghi ORDER_PAID trong cung DB transaction.
        if (paid) {
          const ticketRows = items.flatMap((item) =>
            Array.from({ length: item.quantity }, () => ({
              ticketCode: `TK${randomBytes(14).toString("hex").toUpperCase()}`,
              orderId: order.id,
              userId: order.userId,
              eventId: order.eventId,
              ticketTypeId: item.ticketTypeId,
              seatId: item.seatId,
              status: TicketStatus.SOLD,
            })),
          );

          const issuedTickets = await tx
            .insert(tickets)
            .values(ticketRows)
            .returning({ id: tickets.id });

          await tx.insert(outbox).values({
            eventType: "ORDER_PAID",
            status: OutboxStatus.PENDING,
            payload: {
              orderId: order.id,
              orderCode: order.orderCode,
              userId: order.userId,
              eventId: order.eventId,
              transactionId: transaction.id,
              transactionRef: transaction.transactionRef,
              provider: PaymentProvider.VNPAY,
              amount: order.finalAmount,
              ticketIds: issuedTickets.map((ticket) => ticket.id),
              paidAt: now.toISOString(),
              source: evidence.source,
            },
          });
        }

        if (initial === "LATE_SUCCESS") {
          if (lateRefund) {
            // Moi don chi co mot refund muon (da khoa order nen khong chay dua).
            const [existingRefund] = await tx
              .select({ id: refunds.id })
              .from(refunds)
              .where(
                and(
                  eq(refunds.orderId, order.id),
                  eq(refunds.reason, LATE_REFUND_REASON),
                ),
              )
              .limit(1);

            if (!existingRefund) {
              await tx.insert(refunds).values({
                orderId: order.id,
                ticketId: null,
                amount: transaction.amount,
                status: RefundStatus.PENDING,
                reason: LATE_REFUND_REASON,
                idempotencyKey: `late-refund:${order.id}`,
              });
            }
          }

          await tx.insert(auditLog).values({
            actorRole: "SYSTEM",
            action: lateIssued
              ? "VNPAY_LATE_PAYMENT_ISSUED"
              : "VNPAY_LATE_PAYMENT_REFUND_QUEUED",
            targetType: "TRANSACTION",
            targetId: transaction.id,
            changes: {
              source: evidence.source,
              orderId: order.id,
              orderCode: order.orderCode,
              previousOrderStatus: order.status,
              amountMinor: evidence.amountMinor,
              recordedAt: now.toISOString(),
            },
          });
        }

        return { decision: initial, eventId: order.eventId };
      },
    );

    // Phan E: chi xoa cache Redis sau khi DB da commit.
    // Loi cache khong duoc lam hong ket qua (DB dung, cache tu het han).
    if (
      eventId &&
      (decision === "APPLY_SUCCESS" ||
        decision === "RECORD_FAILURE" ||
        decision === "LATE_SUCCESS")
    ) {
      try {
        await this.eventReadCacheService.invalidate(eventId);
      } catch (error) {
        this.logger.warn(
          `Cache invalidation failed for event ${eventId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    return decision;
  }

  private async tryClaimLateInventory(
    tx: DbTx,
    order: OrderRow,
    items: OrderItemRow[],
    now: Date,
  ): Promise<boolean> {
    // Su kien phai con ban (PUBLISHED) va chua ket thuc.
    const [event] = await tx
      .select({ status: events.status, endTime: events.endTime })
      .from(events)
      .where(eq(events.id, order.eventId))
      .limit(1);

    if (
      !event ||
      event.status !== EventStatus.PUBLISHED ||
      now >= event.endTime
    ) {
      return false;
    }

    // Don PENDING qua han (chua bi don): ghe/kho van dang duoc giu cho don nay.
    const stillHeld = order.status === OrderStatus.PENDING;

    // 1. Kiem tra ghe co so
    const seatedIds = items
      .flatMap((item) => (item.seatId === null ? [] : [item.seatId]))
      .sort();

    const expectedSeatTypeById = new Map(
      items
        .filter((item) => item.seatId !== null)
        .map((item) => [item.seatId!, item.ticketTypeId]),
    );

    if (seatedIds.length > 0) {
      const seatRows = await tx
        .select()
        .from(seats)
        .where(inArray(seats.id, seatedIds))
        .orderBy(asc(seats.id))
        .for("update");

      if (seatRows.length !== seatedIds.length) return false;

      const allClaimable = seatRows.every(
        (seat) =>
          seat.eventId === order.eventId &&
          seat.ticketTypeId === expectedSeatTypeById.get(seat.id) &&
          (seat.status === SeatStatus.AVAILABLE ||
            (seat.status === SeatStatus.HELD && seat.holdOrderId === order.id)),
      );

      if (!allClaimable) return false;
    }

    // 2. Kiem tra ve khong danh so ghe (theo so luong)
    const quantityByType = new Map<string, number>();
    for (const item of items) {
      if (item.seatId === null) {
        quantityByType.set(
          item.ticketTypeId,
          (quantityByType.get(item.ticketTypeId) ?? 0) + item.quantity,
        );
      }
    }

    const typeIds = [...quantityByType.keys()].sort();

    if (typeIds.length > 0) {
      const typeRows = await tx
        .select()
        .from(ticketTypes)
        .where(inArray(ticketTypes.id, typeIds))
        .orderBy(asc(ticketTypes.id))
        .for("update");

      if (typeRows.length !== typeIds.length) return false;

      for (const type of typeRows) {
        const quantity = quantityByType.get(type.id) ?? 0;

        if (type.eventId !== order.eventId || type.isSeated) return false;

        if (stillHeld) {
          if (type.heldCount < quantity) return false;
        } else if (type.soldCount + type.heldCount + quantity > type.capacity) {
          return false;
        }
      }
    }

    // 3. Tat ca deu dung duoc: moi ghi du lieu
    if (seatedIds.length > 0) {
      const updatedSeats = await tx
        .update(seats)
        .set({
          status: SeatStatus.SOLD,
          holdOrderId: null,
          holdExpiresAt: null,
          version: sql`${seats.version} + 1`,
          updatedAt: now,
        })
        .where(inArray(seats.id, seatedIds))
        .returning({ id: seats.id });

      if (updatedSeats.length !== seatedIds.length) {
        throw new Error(
          "VNPAY_LATE_SEAT_CONFLICT: manual reconciliation required",
        );
      }
    }

    for (const [typeId, quantity] of quantityByType) {
      const updated = await tx
        .update(ticketTypes)
        .set({
          soldCount: sql`${ticketTypes.soldCount} + ${quantity}`,
          ...(stillHeld
            ? { heldCount: sql`${ticketTypes.heldCount} - ${quantity}` }
            : {}),
          updatedAt: now,
        })
        .where(eq(ticketTypes.id, typeId))
        .returning({ id: ticketTypes.id });

      if (updated.length !== 1) {
        throw new Error(
          "VNPAY_LATE_INVENTORY_CONFLICT: manual reconciliation required",
        );
      }
    }

    return true;
  }
}
