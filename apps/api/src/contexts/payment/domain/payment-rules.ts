import { randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { OrderStatus, TransactionStatus } from "@tickethub/shared";
import { paymentErrors } from "./payment.errors";
import type { PaymentOrder, PendingVnpayTransaction } from "./payment.models";
import { parseVndAmount } from "./vnpay-amount";

/** Phien thanh toan phai con it nhat 45 giay giu ve. */
export const MIN_REMAINING_HOLD_MS = 45_000;

export function assertOrderPayable(order: PaymentOrder | null, now: Date) {
  if (!order) throw paymentErrors.orderNotFound();
  if (order.status !== OrderStatus.PENDING)
    throw paymentErrors.orderNotPending();
  if (order.expiresAt.getTime() - now.getTime() <= MIN_REMAINING_HOLD_MS) {
    throw paymentErrors.holdTooCloseToExpiry();
  }
  return order;
}

/** Giao dich VNPay da ton tai chi duoc tai su dung khi con PENDING va dung so tien. */
export function assertExistingTransactionReusable(
  existing: PendingVnpayTransaction | null,
  order: PaymentOrder,
): void {
  if (!existing) return;
  if (existing.status !== TransactionStatus.PENDING) {
    throw paymentErrors.transactionNotPending();
  }
  if (existing.amount !== order.finalAmount) {
    throw paymentErrors.amountMismatch();
  }
}

/** So tien thanh toan luon lay tu PostgreSQL, quy ve VND nguyen. */
export function resolveAmountVnd(order: PaymentOrder): number {
  const amountVnd = parseVndAmount(order.finalAmount);
  if (amountVnd === null) throw paymentErrors.invalidAmount();
  return amountVnd;
}

/** Ma giao dich ngau nhien chi gom chu so va chu hoa. */
export function generateTransactionRef(): string {
  return "BE2" + randomBytes(12).toString("hex").toUpperCase();
}

/** Lay IP dau tien trong X-Forwarded-For; sai dinh dang thi dung 127.0.0.1. */
export function resolveClientIp(clientIp: string | undefined): string {
  const raw = clientIp?.split(",")[0]?.trim() || "127.0.0.1";
  return isIP(raw) !== 0 ? raw : "127.0.0.1";
}
