export type UploadErrorKind = "FORBIDDEN" | "BAD_REQUEST" | "NOT_FOUND";

/** Loi nghiep vu cua context Upload; `code` la ma loi on dinh cua API. */
export class UploadDomainError extends Error {
  constructor(
    readonly kind: UploadErrorKind,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "UploadDomainError";
  }
}

export const uploadErrors = {
  organizerNotVerified: () =>
    new UploadDomainError(
      "FORBIDDEN",
      "ORGANIZER_NOT_VERIFIED",
      "Ban tổ chức chưa được xác minh tài khoản",
    ),
  invalidSize: () =>
    new UploadDomainError(
      "BAD_REQUEST",
      "INVALID_IMAGE_SIZE",
      "Kích thước ảnh không hợp lệ (tối đa 5 MiB)",
    ),
  unsupportedFormat: () =>
    new UploadDomainError(
      "BAD_REQUEST",
      "UNSUPPORTED_IMAGE_FORMAT",
      "Hệ thống chỉ hỗ trợ định dạng JPG, PNG và WebP",
    ),
  forbiddenKey: () =>
    new UploadDomainError(
      "FORBIDDEN",
      "FORBIDDEN_IMAGE_KEY",
      "Bạn không có quyền xác nhận tập tin này",
    ),
  imageNotFound: () =>
    new UploadDomainError(
      "NOT_FOUND",
      "IMAGE_NOT_FOUND",
      "Không tìm thấy tệp ảnh trên lưu trữ đám mây",
    ),
  storedSizeInvalid: () =>
    new UploadDomainError(
      "BAD_REQUEST",
      "INVALID_IMAGE_SIZE",
      "Dung lượng ảnh không hợp lệ hoặc vượt quá giới hạn 5 MiB",
    ),
  imageTooSmall: () =>
    new UploadDomainError(
      "BAD_REQUEST",
      "IMAGE_TOO_SMALL",
      "Tập tin không đủ dung lượng của một định dạng ảnh hợp lệ",
    ),
  contentTypeMismatch: () =>
    new UploadDomainError(
      "BAD_REQUEST",
      "CONTENT_TYPE_MISMATCH",
      "Content-Type của tệp tải lên không khớp",
    ),
  readError: () =>
    new UploadDomainError(
      "BAD_REQUEST",
      "IMAGE_READ_ERROR",
      "Không thể đọc nội dung kiểm tra định dạng tệp ảnh",
    ),
  invalidSignature: () =>
    new UploadDomainError(
      "BAD_REQUEST",
      "INVALID_IMAGE_SIGNATURE",
      "Nội dung tệp không khớp với chữ ký định dạng ảnh hợp lệ",
    ),
};
