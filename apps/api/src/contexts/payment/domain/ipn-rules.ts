import { randomBytes } from "node:crypto";
import {
  OrderStatus,
  TransactionStatus,
  type OrderStatus as OrderStatusType,
} from "@tickethub/shared";
import { decideVnpayIpn, type IpnVerdict } from "./ipn-decision";
import type {
  PaymentOrder,
  PaymentTransaction,
  SettlementItem,
  VnpayParams,
} from "./payment.models";
import { toVnpayAmount } from "./vnpay-amount";

/** Callback phai la ket qua cuoi: thanh cong (00/00) hoac that bai that su (khac 00/07, trang thai 02). */
export function isFinalCallback(params: VnpayParams): boolean {
  const success =
    params.vnp_ResponseCode === "00" && params.vnp_TransactionStatus === "00";
  const failure =
    params.vnp_ResponseCode !== "00" &&
    params.vnp_ResponseCode !== "07" &&
    params.vnp_TransactionStatus === "02";
  return success || failure;
}

/** So tien callback phai khop ca giao dich lan don hang (don vi VND x 100). */
export function amountsMatch(
  callbackAmount: string | undefined,
  transactionAmount: string,
  orderAmount: string,
): boolean {
  const tx = toVnpayAmount(transactionAmount);
  const ord = toVnpayAmount(orderAmount);
  return (
    tx !== null &&
    ord !== null &&
    callbackAmount === tx &&
    callbackAmount === ord
  );
}

export interface IpnEvaluation {
  decision: IpnVerdict;
  amountMatches: boolean;
}

export function evaluateIpn(input: {
  params: VnpayParams;
  paymentSuccessful: boolean;
  transaction: Pick<PaymentTransaction, "status" | "amount">;
  order: Pick<PaymentOrder, "status" | "finalAmount" | "expiresAt">;
  now: Date;
}): IpnEvaluation {
  const { params, transaction, order, now } = input;
  const amountMatches = amountsMatch(
    params.vnp_Amount,
    transaction.amount,
    order.finalAmount,
  );

  // Callback that bai da ghi nhan truoc do
  if (
    amountMatches &&
    transaction.status === TransactionStatus.FAILED &&
    order.status === OrderStatus.FAILED &&
    !input.paymentSuccessful
  ) {
    return { decision: "ALREADY_PROCESSED", amountMatches };
  }

  return {
    decision: decideVnpayIpn({
      signatureValid: true,
      transactionFound: true,
      amountMatches,
      orderStatus: order.status as OrderStatusType,
      transactionStatus: transaction.status,
      paymentSuccessful: input.paymentSuccessful,
      orderExpired: now >= order.expiresAt,
    }),
    amountMatches,
  };
}

/** Du lieu chi tiet don hang hop le: so luong duong, ghe so chi 1 ve, khong trung ghe. */
export function areSettlementItemsValid(items: SettlementItem[]): boolean {
  if (items.length === 0) return false;
  const seatedIds = items.flatMap((i) => (i.seatId === null ? [] : [i.seatId]));
  return (
    !items.some(
      (i) => i.quantity <= 0 || (i.seatId !== null && i.quantity !== 1),
    ) && new Set(seatedIds).size === seatedIds.length
  );
}

/** Chi luu cac truong callback can doi soat, khong bao gio luu secret. */
export function buildCallbackEvidence(params: VnpayParams) {
  return {
    vnp_TxnRef: params.vnp_TxnRef ?? null,
    vnp_Amount: params.vnp_Amount ?? null,
    vnp_ResponseCode: params.vnp_ResponseCode ?? null,
    vnp_TransactionStatus: params.vnp_TransactionStatus ?? null,
    vnp_TransactionNo: params.vnp_TransactionNo ?? null,
    vnp_PayDate: params.vnp_PayDate ?? null,
    vnp_BankCode: params.vnp_BankCode ?? null,
  };
}

export function generateTicketCode(): string {
  return `TK${randomBytes(14).toString("hex").toUpperCase()}`;
}
