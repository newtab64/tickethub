export type PayoutErrorKind =
  "NOT_FOUND" | "CONFLICT" | "BAD_REQUEST" | "FORBIDDEN";

/**
 * Loi nghiep vu cua context Payout. `structured` = true nghia la than phan hoi
 * dang { success, error }; nguoc lai la chuoi "CODE: mo ta" nhu hop dong cu.
 */
export class PayoutDomainError extends Error {
  constructor(
    readonly kind: PayoutErrorKind,
    readonly code: string,
    message: string,
    readonly structured = false,
  ) {
    super(message);
    this.name = "PayoutDomainError";
  }
}

const plain = (kind: PayoutErrorKind, code: string, text: string) =>
  new PayoutDomainError(kind, code, `${code}: ${text}`);

export const payoutErrors = {
  eventNotFound: () =>
    plain("NOT_FOUND", "EVENT_NOT_FOUND", "Không tìm thấy sự kiện"),
  payoutNotFound: () =>
    plain("NOT_FOUND", "PAYOUT_NOT_FOUND", "Không tìm thấy lệnh chi trả"),
  eventPayoutAlreadyPaid: () =>
    plain(
      "CONFLICT",
      "PAYOUT_ALREADY_PAID_OUT",
      "Lệnh chi trả cho sự kiện này đã được thanh toán hoàn tất",
    ),
  cannotRecalculatePaid: () =>
    plain(
      "CONFLICT",
      "PAYOUT_ALREADY_PAID_OUT",
      "Không thể tính lại lệnh chi trả đã thanh toán hoàn tất",
    ),
  alreadyApproved: () =>
    plain(
      "CONFLICT",
      "PAYOUT_ALREADY_APPROVED",
      "Lệnh chi trả này đã được phê duyệt trước đó",
    ),
  cannotHoldPaid: () =>
    plain(
      "BAD_REQUEST",
      "CANNOT_HOLD_PAID_OUT",
      "Không thể tạm giữ lệnh chi trả đã hoàn tất",
    ),
  organizerProfileRequired: () =>
    new PayoutDomainError(
      "FORBIDDEN",
      "ORGANIZER_PROFILE_REQUIRED",
      "Tài khoản chưa có hồ sơ ban tổ chức",
      true,
    ),
};
