import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";

import { randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { and, eq } from "drizzle-orm";

import {
  OrderStatus,
  TransactionStatus,
  PaymentProvider,
} from "@tickethub/shared";

import { db } from "../database/db";
import { orders, transactions, idempotencyKeys } from "../database/schema";
import { VnpayGateway } from "./vnpay.gateway";
import { env } from "../config/env.config";
import { parseVndAmount, toVnpayAmount } from "./vnpay-amount";
type PaymentInitResult = {
  orderId: string;
  orderCode: string;
  transactionRef: string;
  paymentUrl: string;
  amountVnd: number;
  expiresAt: string;
};
export type QueryDrDecision =
  | "INVALID_SIGNATURE"
  | "REF_MISMATCH"
  | "NOT_FOUND"
  | "QUERY_UNAVAILABLE"
  | "AMOUNT_MISMATCH"
  | "ALREADY_PAID"
  | "PAYMENT_CONFIRMED_NEEDS_APPLY"
  | "PAYMENT_PENDING"
  | "PAYMENT_FAILED_REPORTED"
  | "MANUAL_REVIEW";
@Injectable()
export class PaymentService {
  async createVnpayPayment(
    userId: string,
    orderId: string,
    clientIp: string,
    idempotencyKey?: string,
  ): Promise<PaymentInitResult> {
    return db.transaction(async (tx) => {
      if (idempotencyKey) {
        const requestPath = `/api/v1/payments/orders/${orderId}/vnpay`;

        const [claimed] = await tx
          .insert(idempotencyKeys)
          .values({
            key: idempotencyKey,
            userId,
            path: requestPath,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          })
          .onConflictDoNothing({
            target: idempotencyKeys.key,
          })
          .returning({ key: idempotencyKeys.key });

        if (!claimed) {
          const [stored] = await tx
            .select()
            .from(idempotencyKeys)
            .where(eq(idempotencyKeys.key, idempotencyKey))
            .for("update");

          if (
            !stored ||
            stored.userId !== userId ||
            stored.path !== requestPath
          ) {
            throw new ConflictException(
              "Idempotency-Key belongs to another request",
            );
          }

          if (stored.expiresAt.getTime() <= Date.now()) {
            throw new ConflictException(
              "Idempotency-Key expired; use a new key",
            );
          }

          if (stored.responseStatus === 200 && stored.responseBody) {
            const cached = stored.responseBody as PaymentInitResult;

            if (Date.parse(cached.expiresAt) <= Date.now()) {
              throw new ConflictException("Payment URL has expired");
            }

            return cached;
          }

          throw new ConflictException("Payment request is incomplete");
        }
      }
      // 1. Khóa đơn hàng để tránh hai request
      // đồng thời tạo hai giao dịch.
      const [order] = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
        .limit(1)
        .for("update");

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      if (order.status !== OrderStatus.PENDING) {
        throw new ConflictException("Order is not pending");
      }

      const now = new Date();

      // Yêu cầu còn tối thiểu 45 giây giữ vé.
      if (order.expiresAt.getTime() - now.getTime() <= 45_000) {
        throw new ConflictException(
          "Order hold is expired or too close to expiry",
        );
      }

      // Tim giao dich VNPay da ton tai.
      // Khoa dong de tranh xu ly dong thoi.
      const [existingTransaction] = await tx
        .select({
          id: transactions.id,
          transactionRef: transactions.transactionRef,
          status: transactions.status,
          amount: transactions.amount,
          vnpCreateDate: transactions.vnpCreateDate,
          paymentUrl: transactions.paymentUrl,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.orderId, order.id),
            eq(transactions.provider, PaymentProvider.VNPAY),
          ),
        )
        .limit(1)
        .for("update");
      if (existingTransaction) {
        if (existingTransaction.status !== TransactionStatus.PENDING) {
          throw new ConflictException("VNPay transaction is no longer pending");
        }
        if (existingTransaction.amount !== order.finalAmount) {
          throw new ConflictException("Payment amount mismatch");
        }
      }

      // 3. Số tiền lấy từ PostgreSQL, không lấy
      // Lay so tien tu PostgreSQL.
      // Dung chung quy tac voi xu ly VNPay IPN.
      const amountVnd = parseVndAmount(order.finalAmount);
      if (amountVnd === null) {
        throw new BadRequestException("Invalid order amount for VNPay");
      }

      // 4. Mã giao dịch ngẫu nhiên, không chứa
      // dấu gạch ngang hoặc ký tự đặc biệt.
      const transactionRef =
        existingTransaction?.transactionRef ??
        "BE2" + randomBytes(12).toString("hex").toUpperCase();

      // 5. Lấy hoặc tạo Payment URL.
      let payment: {
        transactionRef: string;
        paymentUrl: string;
        vnpCreateDate?: string;
      };

      if (existingTransaction) {
        // Giao dịch đã tồn tại: không được tạo lại Payment URL,
        // vì vnp_CreateDate mới sẽ làm lệch với QueryDR/IPN.
        if (
          !existingTransaction.vnpCreateDate ||
          !existingTransaction.paymentUrl
        ) {
          throw new ConflictException(
            "Existing VNPay transaction requires reconciliation",
          );
        }

        payment = {
          transactionRef: existingTransaction.transactionRef,
          paymentUrl: existingTransaction.paymentUrl,
          vnpCreateDate: existingTransaction.vnpCreateDate,
        };
      } else {
        // Giao dịch mới: tạo Payment URL.
        const gateway = new VnpayGateway();

        const rawIp = clientIp?.split(",")[0]?.trim() || "127.0.0.1";
        const ipAddress = isIP(rawIp) !== 0 ? rawIp : "127.0.0.1";

        payment = await gateway.createPaymentUrl({
          transactionRef,
          amountVnd,
          orderInfo: `TicketHub order ${order.orderCode}`,
          returnUrl: env.VNPAY_RETURN_URL,
          ipAddress,
          expiresAt: order.expiresAt,
        });
        if (!payment.vnpCreateDate || !/^\d{14}$/.test(payment.vnpCreateDate)) {
          throw new Error("VNPay create date is missing or invalid");
        }
        await tx.insert(transactions).values({
          orderId: order.id,
          provider: PaymentProvider.VNPAY,
          transactionRef: payment.transactionRef,
          amount: order.finalAmount,
          status: TransactionStatus.PENDING,
          idempotencyKey: `vnpay:${order.id}`,
          vnpCreateDate: payment.vnpCreateDate,
          paymentUrl: payment.paymentUrl,
        });
      }
      const response: PaymentInitResult = {
        orderId: order.id,
        orderCode: order.orderCode,
        transactionRef: payment.transactionRef,
        paymentUrl: payment.paymentUrl,
        amountVnd,
        expiresAt: order.expiresAt.toISOString(),
      };

      if (idempotencyKey) {
        await tx
          .update(idempotencyKeys)
          .set({
            responseStatus: 200,
            responseBody: response,
          })
          .where(eq(idempotencyKeys.key, idempotencyKey));
      }

      return response;
    });
  }
  async inspectQueryDrResponse(
    transactionRef: string,
    rawResponse: unknown,
  ): Promise<QueryDrDecision> {
    // PHAN A: Xac minh chu ky
    const gateway = new VnpayGateway();

    if (!gateway.verifyQueryDrResponse(rawResponse)) {
      return "INVALID_SIGNATURE";
    }

    const response = rawResponse as Record<string, unknown>;

    if (response.vnp_TxnRef !== transactionRef) {
      return "REF_MISMATCH";
    }
    // PHAN B: Tim transaction va order
    const transaction = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.transactionRef, transactionRef),
        eq(transactions.provider, PaymentProvider.VNPAY),
      ),
    });

    if (!transaction) {
      return "NOT_FOUND";
    }

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, transaction.orderId),
    });

    if (!order) {
      return "NOT_FOUND";
    }
    // PHAN C: Doi chieu so tien
    if (response.vnp_ResponseCode === "91") return "PAYMENT_PENDING";
    if (response.vnp_ResponseCode !== "00") return "QUERY_UNAVAILABLE";
    // JSON might represent a signed numeric amount as a safe integer. This
    // conversion runs ONLY after verifyQueryDrResponse() verified the HMAC.
    const responseAmount =
      typeof response.vnp_Amount === "number" &&
      Number.isSafeInteger(response.vnp_Amount) &&
      response.vnp_Amount >= 0
        ? String(response.vnp_Amount)
        : response.vnp_Amount;

    const transactionAmount = toVnpayAmount(transaction.amount);

    const orderAmount = toVnpayAmount(order.finalAmount);

    if (
      transactionAmount === null ||
      orderAmount === null ||
      responseAmount !== transactionAmount ||
      responseAmount !== orderAmount
    ) {
      return "AMOUNT_MISMATCH";
    }
    // PHAN D: Phan loai trang thai
    if (response.vnp_TransactionStatus === "00") {
      if (
        transaction.status === TransactionStatus.SUCCESS &&
        order.status === OrderStatus.PAID
      ) {
        return "ALREADY_PAID";
      }

      // EXPIRED vẫn cần đi qua settlement: nếu còn kho sẽ cấp vé,
      // nếu đã hết ghế sẽ tạo yêu cầu hoàn tiền.
      if (
        transaction.status === TransactionStatus.PENDING &&
        (order.status === OrderStatus.PENDING ||
          order.status === OrderStatus.EXPIRED)
      ) {
        return "PAYMENT_CONFIRMED_NEEDS_APPLY";
      }

      return "MANUAL_REVIEW";
    }

    if (response.vnp_TransactionStatus === "01") {
      return "PAYMENT_PENDING";
    }

    if (response.vnp_TransactionStatus === "02") {
      return "PAYMENT_FAILED_REPORTED";
    }

    return "MANUAL_REVIEW";
  }
}
