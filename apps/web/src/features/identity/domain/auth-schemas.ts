// apps/web/src/validations/auth.ts
import { z } from "zod";
import { UserRole } from "@tickethub/shared";

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Vui lòng nhập địa chỉ email")
    .email("Địa chỉ email không đúng định dạng"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(2, "Họ và tên phải có tối thiểu 2 ký tự")
      .max(150, "Họ và tên tối đa 150 ký tự"),
    email: z
      .string()
      .min(1, "Vui lòng nhập địa chỉ email")
      .email("Địa chỉ email không đúng định dạng"),
    phone: z
      .string()
      .regex(
        /^(0|\+84)[35789][0-9]{8}$/,
        "Số điện thoại không hợp lệ (VD: 0912345678)",
      )
      .or(z.literal(""))
      .optional(),
    password: z
      .string()
      .min(8, "Mật khẩu phải có tối thiểu 8 ký tự")
      .max(100, "Mật khẩu tối đa 100 ký tự"),
    role: z.enum([UserRole.BUYER, UserRole.ORGANIZER]),
    organizationName: z.string().optional(),
  })
  .refine(
    (data) => {
      if (
        data.role === UserRole.ORGANIZER &&
        (!data.organizationName || data.organizationName.trim().length < 2)
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        "Ban tổ chức vui lòng nhập tên doanh nghiệp/đơn vị (tối thiểu 2 ký tự)",
      path: ["organizationName"],
    },
  );

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "Vui lòng nhập địa chỉ email")
    .email("Địa chỉ email không đúng định dạng"),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Vui lòng nhập mã xác thực hoặc token kích hoạt"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
