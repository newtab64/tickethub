import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { PaymentProvider, TransactionStatus } from "@tickethub/shared";

import { db } from "../database/db";
import { orders, transactions } from "../database/schema";

import { PaymentService } from "./payment.service";
import { PaymentSettlementService } from "./payment-settlement.service";
import { VnpayGateway } from "./vnpay.gateway";

import {
  isWellFormedResult,
  pickRawEvidence,
  type VerifiedPaymentResult,
} from "./payment-settlement.types";
import type { QueryDrDecision } from "./payment.service";
import type { IpnDecision } from "./vnpay-ipn.decision";
export type ReconcileResult = QueryDrDecision | IpnDecision;

@Injectable()
export class VnpayReconciliationService {
  private readonly gateway = new VnpayGateway();

  constructor(
    @Inject(PaymentService)
    private readonly paymentService: PaymentService,
    @Inject(PaymentSettlementService)
    private readonly settlementService: PaymentSettlementService,
  ) {}

  async reconcile(
    transactionRef: string,
    ipAddress: string,
  ): Promise<ReconcileResult> {
    // A. Tim giao dich goc trong PostgreSQL
    const transaction = await db.query.transactions.findFirst({
      where: eq(transactions.transactionRef, transactionRef),
    });

    if (!transaction || transaction.provider !== PaymentProvider.VNPAY) {
      return "ORDER_NOT_FOUND";
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      return "ALREADY_PROCESSED";
    }

    if (!transaction.vnpCreateDate) {
      return "MANUAL_REVIEW";
    }

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, transaction.orderId),
    });

    if (!order) {
      return "ORDER_NOT_FOUND";
    }
    // B. Gọi VNPay QueryDR (lỗi kết nối không được biến thành FAILED).
    let rawResponse: unknown;
    try {
      rawResponse = await this.gateway.queryTransactionRaw({
        transactionRef: transaction.transactionRef,
        transactionDate: transaction.vnpCreateDate,
        orderInfo: `TicketHub QueryDR ${order.orderCode}`,
        ipAddress,
      });
    } catch {
      return "QUERY_UNAVAILABLE";
    }
    // C. Xac minh va doi soat response
    const decision = await this.paymentService.inspectQueryDrResponse(
      transaction.transactionRef,
      rawResponse,
    );

    if (
      decision !== "PAYMENT_CONFIRMED_NEEDS_APPLY" &&
      decision !== "PAYMENT_FAILED_REPORTED"
    ) {
      return decision;
    }
    // D. Chuyen ket qua hop le sang SettlementService
    if (
      !rawResponse ||
      typeof rawResponse !== "object" ||
      Array.isArray(rawResponse)
    ) {
      return "MANUAL_REVIEW";
    }

    const data = rawResponse as Record<string, unknown>;
    // Normalize signed numeric amount only after inspectQueryDrResponse()
    // has verified the gateway signature and checked the original order amount.
    const responseAmount =
      typeof data.vnp_Amount === "number" &&
      Number.isSafeInteger(data.vnp_Amount) &&
      data.vnp_Amount >= 0
        ? String(data.vnp_Amount)
        : data.vnp_Amount;

    if (
      data.vnp_TxnRef !== transaction.transactionRef ||
      typeof responseAmount !== "string" ||
      typeof data.vnp_ResponseCode !== "string" ||
      typeof data.vnp_TransactionStatus !== "string" ||
      data.vnp_TransactionType !== "01"
    ) {
      return "MANUAL_REVIEW";
    }
    // QueryDR vnp_ResponseCode=00 nghĩa là lệnh truy vấn hợp lệ;
    // kết quả THANH TOÁN nằm ở vnp_TransactionStatus.
    // Không dùng resolveOutcome (quy tắc IPN) cho QueryDR thất bại.
    const outcome =
      decision === "PAYMENT_CONFIRMED_NEEDS_APPLY" ? "SUCCESS" : "FAILURE";
    const evidence: VerifiedPaymentResult = {
      source: "QUERYDR",
      transactionRef: transaction.transactionRef,
      amountMinor: responseAmount as string,
      outcome,
      responseCode: data.vnp_ResponseCode,
      transactionStatus: data.vnp_TransactionStatus,
      providerTransactionId:
        typeof data.vnp_TransactionNo === "string"
          ? data.vnp_TransactionNo
          : null,
      bankCode:
        typeof data.vnp_BankCode === "string" ? data.vnp_BankCode : null,
      rawEvidence: pickRawEvidence(data),
    };
    // Phan 5: kiem tra dinh dang truoc khi settle
    if (!isWellFormedResult(evidence)) {
      return "MANUAL_REVIEW";
    }
    return this.settlementService.settle(evidence);
  }
}
