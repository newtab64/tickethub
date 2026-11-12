export type BookingErrorKind =
  "NOT_FOUND" | "BAD_REQUEST" | "CONFLICT" | "FORBIDDEN";

/** Loi nghiep vu cua context Booking; than phan hoi luon dang { success, error }. */
export class BookingDomainError extends Error {
  constructor(
    readonly kind: BookingErrorKind,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "BookingDomainError";
  }
}

const err = (kind: BookingErrorKind, code: string, message: string) =>
  new BookingDomainError(kind, code, message);

export const bookingErrors = {
  eventNotFound: () =>
    err("NOT_FOUND", "EVENT_NOT_FOUND", "Không tìm thấy sự kiện"),
  eventNotPublished: () =>
    err(
      "BAD_REQUEST",
      "EVENT_NOT_PUBLISHED",
      "Sự kiện chưa mở bán vé hoặc đã kết thúc",
    ),
  maxTicketsExceeded: () =>
    err(
      "BAD_REQUEST",
      "MAX_TICKETS_EXCEEDED",
      "Số lượng vé tối đa trên mỗi đơn hàng là 6 vé",
    ),
  ticketTypeNotFound: (id: string) =>
    err(
      "NOT_FOUND",
      "TICKET_TYPE_NOT_FOUND",
      `Hạng vé ${id} không tồn tại trong sự kiện`,
    ),
  duplicateSeats: () =>
    err(
      "BAD_REQUEST",
      "DUPLICATE_SEATS",
      "Danh sách ghế yêu cầu chứa vị trí trùng lặp",
    ),
  seatNotFound: () =>
    err(
      "NOT_FOUND",
      "SEAT_NOT_FOUND",
      "Một số ghế yêu cầu không tồn tại trong sự kiện",
    ),
  seatTicketTypeMismatch: () =>
    err(
      "BAD_REQUEST",
      "SEAT_TICKET_TYPE_MISMATCH",
      "Ghế không thuộc hạng vé đã chọn hoặc số lượng không hợp lệ",
    ),
  seatAlreadyHeld: () =>
    err(
      "CONFLICT",
      "SEAT_ALREADY_HELD",
      "Một hoặc nhiều ghế đã được người khác giữ chỗ hoặc đã bán",
    ),
  insufficientSeats: () =>
    err(
      "CONFLICT",
      "INSUFFICIENT_TICKET_CAPACITY",
      "Số lượng ghế trống không còn đủ để giữ chỗ theo yêu cầu",
    ),
  invalidStandingTicketType: () =>
    err("BAD_REQUEST", "INVALID_TICKET_TYPE", "Hạng vé khu đứng không hợp lệ"),
  insufficientStanding: () =>
    err(
      "CONFLICT",
      "INSUFFICIENT_TICKET_CAPACITY",
      "Số lượng vé khu đứng không còn đủ để giữ chỗ",
    ),
  orderToReleaseNotFound: () =>
    err(
      "NOT_FOUND",
      "ORDER_NOT_FOUND",
      "Không tìm thấy đơn hàng cần giải phóng",
    ),
  orderNotPending: (status: string) =>
    err(
      "BAD_REQUEST",
      "ORDER_NOT_PENDING",
      `Chỉ đơn hàng PENDING mới có thể hủy giữ chỗ (trạng thái: ${status})`,
    ),
  orderStatusChanged: () =>
    err(
      "CONFLICT",
      "ORDER_STATUS_CHANGED",
      "Trạng thái đơn hàng đã thay đổi, không thể hủy giữ chỗ",
    ),
  orderNotFound: () =>
    err("NOT_FOUND", "ORDER_NOT_FOUND", "Không tìm thấy đơn hàng"),
  accessDenied: () =>
    err(
      "FORBIDDEN",
      "ACCESS_DENIED",
      "Bạn không có quyền truy cập đơn hàng này",
    ),
};
