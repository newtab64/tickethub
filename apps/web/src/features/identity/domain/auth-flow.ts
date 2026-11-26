import { z } from "zod";

// Step 1 Validation Schema
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
// Optional phone regex if FEATURE_PHONE_AUTH is enabled
// const vnPhoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;

export const identifierSchema = z.object({
  identifier: z
    .string()
    .min(1, "Vui lòng nhập địa chỉ email")
    .refine((val) => {
      const trimmed = val.trim();
      return emailRegex.test(trimmed);
    }, "Vui lòng nhập địa chỉ email hợp lệ"),
});

// Step 2a Password Schema
export const passwordSchema = z.object({
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});

// Step 2b Register Schema
export const registerSchema = z.object({
  fullName: z
    .string()
    .min(2, "Họ và tên tối thiểu 2 ký tự")
    .max(100, "Họ và tên tối đa 100 ký tự"),
  organizationName: z.string().optional(),
  password: z
    .string()
    .min(8, "Mật khẩu phải có tối thiểu 8 ký tự")
    .max(100, "Mật khẩu tối đa 100 ký tự"),
});

export type IdentifierInput = z.infer<typeof identifierSchema>;
export type PasswordInput = z.infer<typeof passwordSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

export type AuthStep = "identifier" | "password" | "register";

/** Buoc dang hien thi: chi vao buoc 2 khi da co dinh danh trong bo nho, nguoc lai quay ve buoc 1. */
export function resolveActiveStep(
  stepParam: string | null,
  identifier: string,
): AuthStep {
  return (stepParam === "password" || stepParam === "register") && identifier
    ? stepParam
    : "identifier";
}

/**
 * Chi chap nhan duong dan noi bo: bat dau bang "/", khong phai URL tuong doi giao thuc
 * ("//host") hay co dau gach cheo nguoc ("/\\host"), va khong tro lai trang xac thuc.
 */
export function isSafeInternalRedirect(value: string | null): value is string {
  return (
    !!value &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\") &&
    !value.startsWith("/auth") &&
    !value.startsWith("/login")
  );
}

/**
 * Trang dich sau khi dang nhap: uu tien tham so `redirect` hop le (duong dan noi bo,
 * khong tro lai trang xac thuc); neu khong thi theo vai tro.
 */
export function resolvePostLoginRedirect(
  redirectParam: string | null,
  role: string | undefined,
): string {
  if (isSafeInternalRedirect(redirectParam)) return redirectParam;
  if (role === "ADMIN") return "/admin";
  if (role === "ORGANIZER") return "/organizer/events";
  return "/";
}

/** Dang ky that bai vi tai khoan vua duoc tao (tranh chap giua buoc kiem tra va buoc gui). */
export function isRegistrationConflict(
  status: number,
  message: string,
): boolean {
  const lower = message.toLowerCase();
  return (
    status === 409 ||
    lower.includes("đã được sử dụng") ||
    lower.includes("tồn tại")
  );
}
