export type EventErrorKind =
  "NOT_FOUND" | "FORBIDDEN" | "BAD_REQUEST" | "CONFLICT";

/**
 * Loi nghiep vu cua context Event. `plainMessage` danh dau loi cu tra ve than
 * phan hoi dang chuoi thay vi { success, error } de giu nguyen hop dong API.
 */
export class EventDomainError extends Error {
  constructor(
    readonly kind: EventErrorKind,
    readonly code: string,
    message: string,
    readonly plainMessage = false,
  ) {
    super(message);
    this.name = "EventDomainError";
  }
}

const err = (kind: EventErrorKind, code: string, message: string) =>
  new EventDomainError(kind, code, message);

export const eventErrors = {
  organizerProfileRequired: () =>
    err(
      "FORBIDDEN",
      "ORGANIZER_PROFILE_REQUIRED",
      "Tài khoản chưa có hồ sơ ban tổ chức",
    ),
  organizerNotVerified: () =>
    err(
      "FORBIDDEN",
      "ORGANIZER_NOT_VERIFIED",
      "Hồ sơ ban tổ chức chưa được quản trị viên phê duyệt",
    ),
  slugExists: (slug: string) =>
    err(
      "CONFLICT",
      "SLUG_ALREADY_EXISTS",
      `Đường dẫn định danh (slug) '${slug}' đã tồn tại trong hệ thống`,
    ),
  organizerEventNotFound: () =>
    err(
      "NOT_FOUND",
      "EVENT_NOT_FOUND",
      "Không tìm thấy sự kiện của ban tổ chức",
    ),
  eventToUpdateNotFound: () =>
    err("NOT_FOUND", "EVENT_NOT_FOUND", "Không tìm thấy sự kiện cần cập nhật"),
  eventNotFound: () =>
    err("NOT_FOUND", "EVENT_NOT_FOUND", "Không tìm thấy sự kiện"),
  publicEventNotFound: () =>
    err("NOT_FOUND", "EVENT_NOT_FOUND", "Không tìm thấy thông tin sự kiện"),
  notOpenForSale: () =>
    new EventDomainError(
      "NOT_FOUND",
      "EVENT_NOT_OPEN_FOR_SALE",
      "Khong tim thay su kien dang mo ban",
      true,
    ),
  cannotEdit: (status: string) =>
    err(
      "BAD_REQUEST",
      "EVENT_CANNOT_BE_EDITED",
      `Chỉ sự kiện ở trạng thái DRAFT mới được phép chỉnh sửa (trạng thái hiện tại: ${status})`,
    ),
  cannotGenerateSeats: () =>
    err(
      "BAD_REQUEST",
      "EVENT_CANNOT_BE_EDITED",
      "Chỉ có thể sinh sơ đồ ghế khi sự kiện ở trạng thái DRAFT",
    ),
  concurrentModification: () =>
    err(
      "CONFLICT",
      "CONCURRENT_MODIFICATION",
      "Dữ liệu sự kiện đã bị thay đổi bởi phiên làm việc khác. Vui lòng làm mới trang.",
    ),
  versionConflict: () =>
    err(
      "CONFLICT",
      "CONCURRENT_MODIFICATION",
      "Cập nhật thất bại do tranh chấp dữ liệu phiên bản",
    ),
  cannotModifySoldSeats: () =>
    err(
      "BAD_REQUEST",
      "CANNOT_MODIFY_SOLD_SEATS",
      "Không thể sinh lại sơ đồ ghế khi đã phát sinh vé bán ra",
    ),
  invalidTicketType: (ticketTypeId: string) =>
    err(
      "BAD_REQUEST",
      "INVALID_TICKET_TYPE",
      `Hạng vé ${ticketTypeId} không thuộc sự kiện này`,
    ),
  ticketTypeNotSeated: (name: string) =>
    err(
      "BAD_REQUEST",
      "TICKET_TYPE_NOT_SEATED",
      `Hạng vé '${name}' là khu đứng, không áp dụng sinh ghế ngồi`,
    ),
  cannotSubmit: (status: string) =>
    err(
      "BAD_REQUEST",
      "INVALID_EVENT_STATUS",
      `Chỉ sự kiện DRAFT mới có thể gửi phê duyệt (trạng thái hiện tại: ${status})`,
    ),
  noTicketTypes: () =>
    err(
      "BAD_REQUEST",
      "NO_TICKET_TYPES",
      "Sự kiện phải có ít nhất 1 hạng vé trước khi gửi phê duyệt",
    ),
  seatsNotGenerated: (name: string) =>
    err(
      "BAD_REQUEST",
      "SEATS_NOT_GENERATED",
      `Hạng vé có số ghế '${name}' chưa được sinh sơ đồ ghế`,
    ),
};
