import { Logger } from "@nestjs/common";

import { and, eq, sql } from "drizzle-orm";

import {
  OrderStatus,
  PaymentProvider,
  RefundStatus,
  TicketStatus,
  TransactionStatus,
} from "@tickethub/shared";

import { db } from "../database/db";

import {
  orders,
  refunds,
  tickets,
  transactions,
  auditLog,
  voucherRedemptions,
} from "../database/schema";

import { toVnpayAmount } from "../payments/vnpay-amount";
import { VnpayGateway } from "../payments/vnpay.gateway";
import { LATE_REFUND_REASON } from "../payments/refund-reasons";
import { classifyRefundQueryDrEvidence } from "./refund-reconcile-evidence";
const logger = new Logger("RefundProcessor");
const gateway = new VnpayGateway();

// VNPay yeu cau ngay theo GMT+7, dinh dang yyyyMMddHHmmss.
function formatVnpayDate(date: Date): string {
  return new Date(date.getTime() + 7 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace(/\D/g, "");
}

// Giu refund o PROCESSING va danh dau can doi soat, kem ly do.
async function markNeedsReconciliation(
  refundId: string,
  requestId: string,
  message: string,
) {
  await db
    .update(refunds)
    .set({
      needsReconciliation: true,
      errorMessage: message,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(refunds.id, refundId),
        eq(refunds.status, RefundStatus.PROCESSING),
        eq(refunds.providerRequestId, requestId),
      ),
    );
}

export async function reserveRefundSend(refundId: string) {
  return db.transaction(async (tx) => {
    // Doc orderId truoc de tuan thu thu tu khoa: Order -> Refund.
    const [identity] = await tx
      .select({ orderId: refunds.orderId })
      .from(refunds)
      .where(eq(refunds.id, refundId))
      .limit(1);

    if (!identity) return null;

    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, identity.orderId))
      .limit(1)
      .for("update");

    const [refund] = await tx
      .select()
      .from(refunds)
      .where(eq(refunds.id, refundId))
      .limit(1)
      .for("update");

    if (!order || !refund) return null;

    // Hang rao chong gui Refund lan hai.
    if (
      refund.status !== RefundStatus.PENDING ||
      refund.providerRequestId !== null ||
      refund.lastAttemptAt !== null ||
      refund.needsReconciliation
    ) {
      return null;
    }

    // [LATE] Refund thanh toan muon: order phai o trang thai het han/huy
    // do IPN muon, khong gan voi ve cu the.
    const isLateRefund = refund.reason === LATE_REFUND_REASON;

    if (isLateRefund) {
      if (order.status !== OrderStatus.EXPIRED || refund.ticketId !== null) {
        throw new Error("REFUND_REQUIRES_MANUAL_REVIEW");
      }
    } else if (order.status !== OrderStatus.PAID || refund.ticketId !== null) {
      throw new Error("REFUND_REQUIRES_MANUAL_REVIEW");
    }

    const [payment] = await tx
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.orderId, order.id),
          eq(transactions.provider, PaymentProvider.VNPAY),
          eq(transactions.status, TransactionStatus.SUCCESS),
        ),
      )
      .limit(1)
      .for("update");

    if (!payment?.vnpCreateDate) {
      throw new Error("ORIGINAL_PAYMENT_NOT_VERIFIED");
    }

    const orderTickets = await tx
      .select()
      .from(tickets)
      .where(eq(tickets.orderId, order.id))
      .for("update");

    if (isLateRefund) {
      // [LATE] Don het ghe KHONG duoc co ve hieu luc. Neu co ve SOLD hoac
      // CHECKED_IN thi du lieu mau thuan: dung lai de doi soat.
      if (
        orderTickets.some(
          (t) =>
            t.status === TicketStatus.SOLD ||
            t.status === TicketStatus.CHECKED_IN,
        )
      ) {
        throw new Error("TICKETS_NOT_REFUNDABLE");
      }
    } else if (
      orderTickets.length === 0 ||
      orderTickets.some(
        (t) => t.status !== TicketStatus.SOLD || t.checkedInAt !== null,
      )
    ) {
      throw new Error("TICKETS_NOT_REFUNDABLE");
    }

    const amountMinor = toVnpayAmount(refund.amount);
    const originalAmountMinor = toVnpayAmount(payment.amount);

    if (!amountMinor || !originalAmountMinor) {
      throw new Error("INVALID_REFUND_AMOUNT");
    }

    // [LATE] Refund muon phai hoan DUNG so tien da thu.
    if (isLateRefund && amountMinor !== originalAmountMinor) {
      throw new Error("INVALID_REFUND_AMOUNT");
    }

    const now = new Date();

    // UUID bo dau gach ngang: 32 ky tu.
    const requestId = refund.id.replace(/-/g, "");

    const payload = gateway.buildRefundRequest({
      requestId,
      transactionRef: payment.transactionRef,
      transactionDate: payment.vnpCreateDate,
      ...(payment.providerTxNumber != null
        ? { transactionNo: payment.providerTxNumber }
        : {}),
      originalAmountMinor,
      refundAmountMinor: amountMinor,
      createDate: formatVnpayDate(now),
      createBy: "tickethub-system",
      ipAddress: process.env.VNPAY_REFUND_IP ?? "127.0.0.1",
      orderInfo: `Refund TicketHub ${order.orderCode}`,
    });

    // Ghi trang thai TRUOC khi goi VNPay.
    await tx
      .update(refunds)
      .set({
        status: RefundStatus.PROCESSING,
        providerRequestId: requestId,
        lastAttemptAt: now,
        needsReconciliation: true,
        retryCount: sql`${refunds.retryCount} + 1`,
        errorMessage: "REFUND_SEND_RESERVED",
        updatedAt: now,
      })
      .where(eq(refunds.id, refund.id));

    await tx.insert(auditLog).values({
      actorRole: "SYSTEM",
      action: "REFUND_SEND_RESERVED",
      targetType: "REFUND",
      targetId: refund.id,
      changes: {
        requestId,
        transactionRef: payment.transactionRef,
        amountMinor,
        reason: refund.reason ?? null, // [LATE]
      },
    });
    return {
      refundId: refund.id,
      requestId,
      payload,
      originalAmountMinor,
      refundAmountMinor: amountMinor,
    };
  });
}

export async function processRefundJob(refundId: string) {
  const reserved = await reserveRefundSend(refundId);

  if (!reserved) {
    return { skipped: true, reason: "NOT_PENDING" };
  }

  const requestId = reserved.requestId;

  let raw: unknown;

  try {
    // Lenh HTTP Refund duy nhat cho refund nay.
    raw = await gateway.postRefundRaw(reserved.payload);
  } catch (error) {
    // Khong retry POST neu HTTP timeout hoac mat ket noi.
    logger.error(
      `Refund ${refundId}: ket qua HTTP khong xac dinh`,
      error instanceof Error ? error.stack : String(error),
    );

    await markNeedsReconciliation(
      refundId,
      requestId,
      "REFUND_HTTP_RESULT_UNKNOWN",
    );

    return { requiresReconciliation: true };
  }

  if (!gateway.verifyRefundResponse(raw, reserved.payload)) {
    await markNeedsReconciliation(
      refundId,
      requestId,
      "REFUND_INVALID_PROVIDER_RESPONSE",
    );

    return {
      requiresReconciliation: true,
      reason: "INVALID_PROVIDER_RESPONSE",
    };
  }

  const response = raw as Record<string, string>;

  // Chi cong nhan hoan tat khi ca response va
  // trang thai giao dich deu xac nhan thanh cong.
  const confirmedSuccess =
    response.vnp_ResponseCode === "00" &&
    response.vnp_TransactionStatus === "00";

  if (!confirmedSuccess) {
    await markNeedsReconciliation(
      refundId,
      requestId,
      `REFUND_REVIEW_${response.vnp_ResponseCode}_` +
        response.vnp_TransactionStatus,
    );

    return {
      requiresReconciliation: true,
      responseCode: response.vnp_ResponseCode,
      transactionStatus: response.vnp_TransactionStatus,
    };
  }

  // So tien VNPay xac nhan phai khop so tien da yeu cau hoan.
  if (
    response.vnp_Amount !== undefined &&
    response.vnp_Amount !== reserved.refundAmountMinor
  ) {
    await markNeedsReconciliation(
      refundId,
      requestId,
      "REFUND_RESPONSE_AMOUNT_MISMATCH",
    );

    return {
      requiresReconciliation: true,
      reason: "RESPONSE_AMOUNT_MISMATCH",
    };
  }

  // VNPay da hoan tien that. Neu ghi DB loi thi KHONG duoc de
  // exception thoat ra ngoai lam job bi retry; giu o PROCESSING
  // va danh dau doi soat.
  try {
    await finalizeSuccessfulRefund(
      refundId,
      requestId,
      reserved.originalAmountMinor,
      response,
    );
  } catch (error) {
    logger.error(
      `Refund ${refundId}: VNPay da hoan tien nhung ghi DB that bai`,
      error instanceof Error ? error.stack : String(error),
    );

    await markNeedsReconciliation(
      refundId,
      requestId,
      "REFUND_FINALIZE_FAILED",
    );

    return {
      requiresReconciliation: true,
      reason: "FINALIZE_FAILED",
    };
  }

  return { completed: true };
}

export async function finalizeSuccessfulRefund(
  refundId: string,
  requestId: string,
  originalAmountMinor: string,
  response: Record<string, string>,
) {
  await db.transaction(async (tx) => {
    const [identity] = await tx
      .select({ orderId: refunds.orderId })
      .from(refunds)
      .where(eq(refunds.id, refundId))
      .limit(1);

    if (!identity) {
      throw new Error("REFUND_NOT_FOUND");
    }

    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, identity.orderId))
      .limit(1)
      .for("update");

    const [refund] = await tx
      .select()
      .from(refunds)
      .where(eq(refunds.id, refundId))
      .limit(1)
      .for("update");

    if (!order || !refund) {
      throw new Error("REFUND_NOT_FOUND");
    }

    if (refund.status === RefundStatus.COMPLETED) {
      return;
    }

    if (
      refund.status !== RefundStatus.PROCESSING ||
      refund.providerRequestId !== requestId
    ) {
      throw new Error("REFUND_STATE_CONFLICT");
    }

    const isLateRefund = refund.reason === LATE_REFUND_REASON; // [LATE]

    const orderTickets = await tx
      .select()
      .from(tickets)
      .where(eq(tickets.orderId, order.id))
      .for("update");

    if (isLateRefund) {
      // [LATE] Khong co ve nao de huy; chi dam bao khong co ve hieu luc.
      if (
        orderTickets.some(
          (t) =>
            t.status === TicketStatus.SOLD ||
            t.status === TicketStatus.CHECKED_IN,
        )
      ) {
        throw new Error("REFUND_TICKET_CONFLICT");
      }
    } else if (
      orderTickets.length === 0 ||
      orderTickets.some(
        (t) => t.status !== TicketStatus.SOLD || t.checkedInAt !== null,
      )
    ) {
      throw new Error("REFUND_TICKET_CONFLICT");
    }

    const now = new Date();

    // Huy ve sau khi co ket qua hoan tien hop le.
    // [LATE] Don thanh toan muon khong co ve SOLD nen bo qua buoc nay.
    if (!isLateRefund) {
      await tx
        .update(tickets)
        .set({
          status: TicketStatus.CANCELLED,
          updatedAt: now,
        })
        .where(eq(tickets.orderId, order.id));
    }

    await tx
      .update(refunds)
      .set({
        status: RefundStatus.COMPLETED,
        needsReconciliation: false,
        providerRefundRef: response.vnp_TransactionNo,
        errorMessage: null,
        processedAt: now,
        updatedAt: now,
      })
      .where(eq(refunds.id, refundId));

    // LATE: funds are returned, so the voucher's reserved use can be released.
    // Do not release this voucher before payment provider refund confirmation.
    if (isLateRefund) {
      await tx
        .update(voucherRedemptions)
        .set({ status: "RELEASED" })
        .where(
          and(
            eq(voucherRedemptions.orderId, order.id),
            eq(voucherRedemptions.status, "RESERVED"),
          ),
        );
    }

    // Chi danh dau Order REFUNDED khi hoan du
    // toan bo so tien ban dau.
    // [LATE] Don thanh toan muon giu nguyen trang thai het han/huy.
    if (!isLateRefund && toVnpayAmount(refund.amount) === originalAmountMinor) {
      await tx
        .update(orders)
        .set({
          status: OrderStatus.REFUNDED,
          updatedAt: now,
        })
        .where(eq(orders.id, order.id));
    }

    await tx.insert(auditLog).values({
      actorRole: "SYSTEM",
      action: "REFUND_COMPLETED",
      targetType: "REFUND",
      targetId: refundId,
      changes: {
        requestId,
        responseId: response.vnp_ResponseId,
        providerRefundRef: response.vnp_TransactionNo,
        amountMinor: response.vnp_Amount,
        responseCode: response.vnp_ResponseCode,
        transactionStatus: response.vnp_TransactionStatus,
        reason: refund.reason ?? null, // [LATE]
      },
    });
  });
}

/** Retry only a signed QueryDR observation, never the Refund POST. In
 * particular, QueryDR returning the original payment (type 01) is NOT proof
 * that no refund has occurred. That case is escalated after the retry budget.
 */
export async function processRefundReconciliationJob(refundId: string) {
  // A read-only snapshot is sufficient because finalization locks Order -> Refund
  // and confirms the request id again under the lock.
  const [refund] = await db
    .select()
    .from(refunds)
    .where(eq(refunds.id, refundId))
    .limit(1);

  if (!refund || refund.status === RefundStatus.COMPLETED) {
    return { skipped: true, reason: "NOT_ACTIVE" };
  }
  if (
    refund.status !== RefundStatus.PROCESSING ||
    !refund.needsReconciliation ||
    !refund.providerRequestId
  ) {
    return { skipped: true, reason: "NOT_AWAITING_RECONCILIATION" };
  }

  const [payment] = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.orderId, refund.orderId),
        eq(transactions.provider, PaymentProvider.VNPAY),
        eq(transactions.status, TransactionStatus.SUCCESS),
      ),
    )
    .limit(1);

  if (!payment?.vnpCreateDate) {
    throw new Error("NO_VERIFIED_ORIGINAL_PAYMENT");
  }
  const amountMinor = toVnpayAmount(refund.amount);
  const originalAmountMinor = toVnpayAmount(payment.amount);
  if (!amountMinor || !originalAmountMinor) {
    throw new Error("INVALID_REFUND_AMOUNT");
  }

  // This is a READ: BullMQ may retry with exponential backoff.
  const raw = await gateway.queryTransactionRaw({
    transactionRef: payment.transactionRef,
    transactionDate: payment.vnpCreateDate,
    orderInfo: `Query refund TicketHub ${refund.id.replace(/-/g, "")}`,
    ipAddress: process.env.VNPAY_REFUND_IP ?? "127.0.0.1",
  });
  if (!gateway.verifyQueryDrResponse(raw)) {
    throw new Error("UNVERIFIED_QUERYDR_RESPONSE");
  }

  const data = raw as Record<string, string>;
  const evidence = classifyRefundQueryDrEvidence(data, {
    txnRef: payment.transactionRef,
    amountMinor,
    refundType: amountMinor === originalAmountMinor ? "02" : "03",
  });

  if (evidence !== "REFUNDED") {
    // vnp_ResponseCode 94, refund status 05/06, and payment type 01
    // are inconclusive. No automatic resend of the refund POST.
    await markNeedsReconciliation(
      refundId,
      refund.providerRequestId,
      `QUERYDR_INCONCLUSIVE_${data.vnp_ResponseCode ?? "N_A"}_${data.vnp_TransactionStatus ?? "N_A"}`,
    );
    throw new Error("QUERYDR_REFUND_NOT_CONFIRMED");
  }

  try {
    await finalizeSuccessfulRefund(
      refundId,
      refund.providerRequestId,
      originalAmountMinor,
      data,
    );
  } catch (error) {
    await markNeedsReconciliation(
      refundId,
      refund.providerRequestId,
      "REFUND_RECONCILE_FINALIZE_FAILED",
    );
    throw error;
  }
  return { reconciled: true, refundId };
}
