export type IdentityErrorKind =
  "CONFLICT" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND";

/** Loi nghiep vu cua context Identity; `code` la ma loi on dinh cua API. */
export class IdentityDomainError extends Error {
  constructor(
    readonly kind: IdentityErrorKind,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "IdentityDomainError";
  }
}

const err = (kind: IdentityErrorKind, code: string, message: string) =>
  new IdentityDomainError(kind, code, message);

export const identityErrors = {
  emailAlreadyExists: () =>
    err(
      "CONFLICT",
      "EMAIL_ALREADY_EXISTS",
      "Địa chỉ email đã được đăng ký trong hệ thống",
    ),
  invalidVerificationToken: () =>
    err(
      "UNAUTHORIZED",
      "INVALID_VERIFICATION_TOKEN",
      "Mã xác thực email không hợp lệ hoặc đã hết hạn",
    ),
  notEmailVerificationToken: () =>
    err(
      "UNAUTHORIZED",
      "INVALID_TOKEN_TYPE",
      "Mã token không đúng mục đích xác thực email",
    ),
  notRefreshToken: () =>
    err(
      "UNAUTHORIZED",
      "INVALID_TOKEN_TYPE",
      "Token cung cấp không phải refresh token",
    ),
  userNotFound: () =>
    err("NOT_FOUND", "USER_NOT_FOUND", "Người dùng không tồn tại"),
  profileNotFound: () =>
    err("NOT_FOUND", "USER_NOT_FOUND", "Không tìm thấy thông tin người dùng"),
  invalidCredentials: () =>
    err(
      "UNAUTHORIZED",
      "INVALID_CREDENTIALS",
      "Email hoặc mật khẩu không chính xác",
    ),
  invalidCredentialsWithRemaining: (remaining: number) =>
    err(
      "UNAUTHORIZED",
      "INVALID_CREDENTIALS",
      `Email hoặc mật khẩu không chính xác. Số lần còn lại: ${remaining}`,
    ),
  accountLockedFor: (minutes: number) =>
    err(
      "FORBIDDEN",
      "ACCOUNT_LOCKED",
      `Tài khoản tạm thời bị khóa do nhập sai mật khẩu quá 5 lần. Thử lại sau ${minutes} phút.`,
    ),
  accountJustLocked: () =>
    err(
      "FORBIDDEN",
      "ACCOUNT_LOCKED",
      "Tài khoản đã bị tạm khóa 15 phút do nhập sai mật khẩu 5 lần liên tiếp.",
    ),
  emailNotVerified: () =>
    err(
      "FORBIDDEN",
      "EMAIL_NOT_VERIFIED",
      "Tài khoản chưa được kích hoạt email. Vui lòng kiểm tra hộp thư.",
    ),
  accountSuspended: () =>
    err(
      "FORBIDDEN",
      "ACCOUNT_SUSPENDED",
      "Tài khoản đã bị quản trị viên khóa.",
    ),
  invalidRefreshToken: () =>
    err(
      "UNAUTHORIZED",
      "INVALID_REFRESH_TOKEN",
      "Refresh token không hợp lệ hoặc đã hết hạn",
    ),
  userInactive: () =>
    err(
      "UNAUTHORIZED",
      "USER_INACTIVE",
      "Tài khoản không tồn tại hoặc không ở trạng thái hoạt động",
    ),
};
