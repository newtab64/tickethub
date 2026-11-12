export type ModerationErrorKind = "NOT_FOUND" | "CONFLICT" | "BAD_REQUEST";

/**
 * Loi nghiep vu cua context Moderation. `structured` = true: than phan hoi
 * dang { success, error }; nguoc lai la chuoi "CODE: mo ta" nhu hop dong cu.
 */
export class ModerationDomainError extends Error {
  constructor(
    readonly kind: ModerationErrorKind,
    readonly code: string,
    message: string,
    readonly structured: boolean,
  ) {
    super(message);
    this.name = "ModerationDomainError";
  }
}

const structured = (kind: ModerationErrorKind, code: string, text: string) =>
  new ModerationDomainError(kind, code, text, true);
const plain = (kind: ModerationErrorKind, code: string, text: string) =>
  new ModerationDomainError(kind, code, `${code}: ${text}`, false);

export const moderationErrors = {
  // --- Kiem duyet KYC / phe duyet su kien (than { success, error }) ---
  organizerNotFound: () =>
    structured(
      "NOT_FOUND",
      "ORGANIZER_NOT_FOUND",
      "Không tìm thấy hồ sơ Ban tổ chức",
    ),
  organizerAlreadyProcessed: () =>
    structured(
      "CONFLICT",
      "ORGANIZER_ALREADY_PROCESSED",
      "Hồ sơ Ban tổ chức đã được xử lý trước đó",
    ),
  organizerConcurrent: () =>
    structured(
      "CONFLICT",
      "CONCURRENT_MODIFICATION",
      "Hồ sơ đã được xử lý hoặc version không còn hợp lệ",
    ),
  ownerAccountNotFound: () =>
    structured(
      "NOT_FOUND",
      "ORGANIZER_ACCOUNT_NOT_FOUND",
      "Không tìm thấy tài khoản người dùng của Ban tổ chức",
    ),
  reviewEventNotFound: () =>
    structured("NOT_FOUND", "EVENT_NOT_FOUND", "Không tìm thấy sự kiện"),
  eventNotInReview: () =>
    structured(
      "CONFLICT",
      "EVENT_NOT_IN_REVIEW",
      "Sự kiện không ở trạng thái chờ phê duyệt",
    ),
  eventReviewConcurrent: () =>
    structured(
      "CONFLICT",
      "CONCURRENT_MODIFICATION",
      "Sự kiện đã được xử lý hoặc version không còn hợp lệ",
    ),

  // --- Kill Switch, khoi phuc, audit log (than chuoi "CODE: mo ta") ---
  eventNotFound: () =>
    plain("NOT_FOUND", "EVENT_NOT_FOUND", "Không tìm thấy sự kiện"),
  eventAlreadySuspended: () =>
    plain(
      "CONFLICT",
      "EVENT_ALREADY_SUSPENDED",
      "Sự kiện đã bị ngắt khẩn cấp trước đó",
    ),
  eventNotPublished: () =>
    plain(
      "BAD_REQUEST",
      "EVENT_NOT_PUBLISHED",
      "Chỉ có thể ngắt khẩn cấp sự kiện đang mở bán công khai",
    ),
  versionMismatch: () =>
    plain(
      "CONFLICT",
      "CONCURRENT_MODIFICATION",
      "Phiên bản sự kiện không khớp (optimistic lock)",
    ),
  updateConflict: () =>
    plain(
      "CONFLICT",
      "CONCURRENT_MODIFICATION",
      "Không thể cập nhật sự kiện do xung đột đồng thời",
    ),
  eventNotSuspended: () =>
    plain(
      "BAD_REQUEST",
      "EVENT_NOT_SUSPENDED",
      "Chỉ có thể khôi phục sự kiện đang ở trạng thái đình chỉ",
    ),
  eventAlreadyEnded: () =>
    plain(
      "BAD_REQUEST",
      "EVENT_ALREADY_ENDED",
      "Không thể khôi phục sự kiện đã kết thúc",
    ),
};
