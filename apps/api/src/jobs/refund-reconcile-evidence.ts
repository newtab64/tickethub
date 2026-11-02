export type RefundEvidence = "REFUNDED" | "INCONCLUSIVE";

export function classifyRefundQueryDrEvidence(
  data: Record<string, string>,
  expected: { txnRef: string; amountMinor: string; refundType: "02" | "03" },
): RefundEvidence {
  if (
    data.vnp_ResponseCode !== "00" ||
    data.vnp_TransactionStatus !== "00" ||
    data.vnp_TxnRef !== expected.txnRef ||
    data.vnp_Amount !== expected.amountMinor ||
    data.vnp_TransactionType !== expected.refundType ||
    !/^\d{1,15}$/.test(data.vnp_TransactionNo ?? "")
  ) {
    return "INCONCLUSIVE";
  }
  return "REFUNDED";
}
