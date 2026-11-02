export type SettlementSource = "IPN" | "QUERYDR";

export type PaymentOutcome = "SUCCESS" | "FAILURE";

/**
 * Kết quả thanh toán ĐÃ được xác minh chữ ký.
 * Chỉ tạo ra sau khi gateway verify, service không tự dựng bằng tay.
 */
export interface VerifiedPaymentResult {
  source: SettlementSource;
  transactionRef: string;

  // Số tiền theo đơn vị VNPay: VND x 100 (chuỗi số nguyên dương)
  amountMinor: string;

  // Chỉ chấp nhận kết quả giao dịch đã kết thúc
  outcome: PaymentOutcome;

  responseCode: string;
  transactionStatus: string;

  providerTransactionId: string | null;
  bankCode: string | null;

  // Chỉ giữ các trường cần thiết để đối soát (không có chữ ký/secret)
  rawEvidence: Record<string, string | null>;
}

/** Quyết định sau khi đối chiếu với Order/Transaction trong DB. */
export type SettlementDecision =
  | "APPLY_SUCCESS"
  | "RECORD_FAILURE"
  | "ALREADY_PROCESSED"
  | "MANUAL_REVIEW"
  | "AMOUNT_MISMATCH"
  | "NOT_FOUND";

/** Whitelist các trường VNPay được phép lưu làm bằng chứng. */
export const RAW_EVIDENCE_FIELDS = [
  "vnp_TmnCode",
  "vnp_TxnRef",
  "vnp_Amount",
  "vnp_BankCode",
  "vnp_BankTranNo",
  "vnp_CardType",
  "vnp_PayDate",
  "vnp_ResponseCode",
  "vnp_TransactionNo",
  "vnp_TransactionStatus",
  "vnp_OrderInfo",
] as const;

const TXN_REF_REGEX = /^[A-Za-z0-9]{1,100}$/;
const AMOUNT_MINOR_REGEX = /^[1-9]\d*$/;

/** Lọc dữ liệu thô của VNPay, chỉ giữ trường trong whitelist. */
export function pickRawEvidence(
  source: Record<string, unknown>,
): Record<string, string | null> {
  const evidence: Record<string, string | null> = {};

  for (const field of RAW_EVIDENCE_FIELDS) {
    const value = source[field];
    evidence[field] = typeof value === "string" ? value : null;
  }

  return evidence;
}

/**
 * Nguồn duy nhất quyết định kết quả cuối cùng, dùng chung cho IPN và QueryDR.
 * Trả null nếu chưa kết thúc (ví dụ "01") hoặc cần đối soát tay (ví dụ "07").
 */
export function resolveOutcome(
  responseCode: string,
  transactionStatus: string,
): PaymentOutcome | null {
  if (responseCode === "00" && transactionStatus === "00") {
    return "SUCCESS";
  }

  if (
    transactionStatus === "02" &&
    responseCode !== "00" &&
    responseCode !== "07"
  ) {
    return "FAILURE";
  }

  return null;
}

/** Kiểm tra cấu trúc VerifiedPaymentResult trước khi áp vào DB. */
export function isWellFormedResult(result: VerifiedPaymentResult): boolean {
  return (
    TXN_REF_REGEX.test(result.transactionRef) &&
    AMOUNT_MINOR_REGEX.test(result.amountMinor) &&
    BigInt(result.amountMinor) % 100n === 0n &&
    result.responseCode.length > 0 &&
    result.transactionStatus.length > 0
  );
}
