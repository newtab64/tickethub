export const MAX_REFUND_ATTEMPTS = 3;
export const MAX_RECONCILE_ATTEMPTS = 5;

const BASE_DELAY_MS = 5 * 60 * 1000;
const MAX_DELAY_MS = 60 * 60 * 1000;

export function computeRetryDelayMs(
  attemptsMade: number,
  random: () => number = Math.random,
): number {
  if (!Number.isInteger(attemptsMade) || attemptsMade < 1) {
    throw new Error("INVALID_ATTEMPT_COUNT");
  }
  const exponential = Math.min(
    BASE_DELAY_MS * 2 ** (attemptsMade - 1),
    MAX_DELAY_MS,
  );
  const jitter = 0.8 + random() * 0.4;
  return Math.round(exponential * jitter);
}

export type ProviderOutcome = "SUCCESS" | "DEFINITIVE_FAILURE" | "UNKNOWN";

export const DEFINITIVE_FAILURE_CODES = new Set<string>([]);

export function classifyRefundResponse(response: {
  vnp_ResponseCode?: string;
  vnp_TransactionStatus?: string;
}): ProviderOutcome {
  if (
    response.vnp_ResponseCode === "00" &&
    response.vnp_TransactionStatus === "00"
  ) {
    return "SUCCESS";
  }
  if (
    response.vnp_ResponseCode &&
    DEFINITIVE_FAILURE_CODES.has(response.vnp_ResponseCode)
  ) {
    return "DEFINITIVE_FAILURE";
  }
  return "UNKNOWN";
}

export type RefundNextStep =
  "FINALIZE" | "SCHEDULE_RETRY" | "MARK_FAILED" | "RECONCILE";

export function decideRefundNextStep(
  outcome: ProviderOutcome,
  attemptsMade: number,
  maxAttempts: number = MAX_REFUND_ATTEMPTS,
): RefundNextStep {
  if (outcome === "SUCCESS") return "FINALIZE";
  if (outcome === "UNKNOWN") return "RECONCILE";
  return attemptsMade >= maxAttempts ? "MARK_FAILED" : "SCHEDULE_RETRY";
}

// Ket qua doi soat: truy van VNPay xem refund da xay ra chua.
export type ReconcileQueryResult = "REFUNDED" | "NOT_REFUNDED" | "UNKNOWN";
export type ReconcileAction =
  "FINALIZE" | "SCHEDULE_RETRY" | "MARK_FAILED" | "KEEP_WAITING" | "ESCALATE";

export function decideReconcile(
  result: ReconcileQueryResult,
  attemptsMade: number,
  reconcileAttempts: number,
): ReconcileAction {
  if (result === "REFUNDED") return "FINALIZE";
  if (result === "NOT_REFUNDED") {
    return attemptsMade >= MAX_REFUND_ATTEMPTS
      ? "MARK_FAILED"
      : "SCHEDULE_RETRY";
  }
  return reconcileAttempts >= MAX_RECONCILE_ATTEMPTS
    ? "ESCALATE"
    : "KEEP_WAITING";
}
