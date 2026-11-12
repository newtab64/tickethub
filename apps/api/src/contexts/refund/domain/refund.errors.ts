export type RefundErrorKind =
  "NOT_FOUND" | "FORBIDDEN" | "BAD_REQUEST" | "CONFLICT";

/**
 * Loi nghiep vu cua context Refund. Tang domain khong phu thuoc HTTP;
 * tang interface chiu trach nhiem anh xa `kind` sang ma trang thai HTTP.
 */
export class RefundDomainError extends Error {
  constructor(
    readonly kind: RefundErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "RefundDomainError";
  }
}

export const refundErrors = {
  orderNotFound: () => new RefundDomainError("NOT_FOUND", "ORDER_NOT_FOUND"),
  eventNotFound: () => new RefundDomainError("NOT_FOUND", "EVENT_NOT_FOUND"),
  ticketsNotFound: () =>
    new RefundDomainError("NOT_FOUND", "SOME_TICKETS_NOT_FOUND"),
  accessDenied: () => new RefundDomainError("FORBIDDEN", "ACCESS_DENIED"),
  orderNotPaid: () => new RefundDomainError("BAD_REQUEST", "ORDER_NOT_PAID"),
  policyNotEligible: () =>
    new RefundDomainError(
      "BAD_REQUEST",
      "REFUND_POLICY_NOT_ELIGIBLE: Event policy does not allow refund at this time",
    ),
  ticketNotEligible: (ticketId: string, status: string) =>
    new RefundDomainError(
      "CONFLICT",
      `TICKET_NOT_ELIGIBLE_FOR_REFUND: Ticket ${ticketId} is ${status}`,
    ),
};
