/** QueryDR is a READ operation. Never use this policy to retry POST refund. */
export const FIRST_QUERY_DELAY_MS = 6 * 60_000;
export const MAX_QUERY_ATTEMPTS = 5;

export type QueryFollowup = "DONE" | "RETRY" | "NEEDS_ATTENTION";

export function queryDrRetryDelayMs(attempt: number): number {
  if (!Number.isSafeInteger(attempt) || attempt < 1) {
    throw new Error("Invalid QueryDR attempt");
  }
  return Math.min(FIRST_QUERY_DELAY_MS * 2 ** (attempt - 1), 60 * 60_000);
}

/** Treat unexpected evidence and inconsistent states as operator-attention cases. */
export function classifyQueryDrDecision(decision: string): QueryFollowup {
  if (
    [
      "APPLY_SUCCESS",
      "LATE_SUCCESS",
      "RECORD_FAILURE",
      "ALREADY_PROCESSED",
      "ALREADY_PAID",
    ].includes(decision)
  )
    return "DONE";
  if (["PAYMENT_PENDING", "QUERY_UNAVAILABLE"].includes(decision)) {
    return "RETRY";
  }
  return "NEEDS_ATTENTION";
}
