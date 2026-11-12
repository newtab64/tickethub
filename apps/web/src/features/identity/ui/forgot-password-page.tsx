// apps/web/src/app/(auth)/forgot-password/page.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Mail, AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import {
  forgotPasswordSchema,
  ForgotPasswordInput,
} from "../domain/auth-schemas";
import { authApi } from "../api/auth-api";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

export function ForgotPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [sentSuccess, setSentSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setServerError(null);
    try {
      await authApi.forgotPassword(data.email);
      setSentSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError(
          "Không thể gửi yêu cầu khôi phục lúc này. Vui lòng thử lại sau.",
        );
      }
    }
  };

  return (
    <Card className="shadow-lg shadow-slate-900/5 border-slate-200/90 rounded-2xl bg-white">
      <CardHeader className="text-center space-y-2 pb-2">
        <div className="mx-auto size-11 rounded-full bg-emerald-50 border border-emerald-200/80 text-primary flex items-center justify-center">
          <KeyRound className="size-5" />
        </div>
        <CardTitle className="text-2xl font-bold text-slate-900">
          Khôi phục mật khẩu
        </CardTitle>
        <CardDescription className="text-slate-500">
          Nhập email đăng ký để nhận liên kết đặt lại mật khẩu
        </CardDescription>
      </CardHeader>

      {sentSuccess ? (
        <CardContent className="space-y-4 py-4 text-center">
          <div className="inline-flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs sm:text-sm font-medium">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>
              Chúng tôi đã gửi hướng dẫn đặt lại mật khẩu về email của bạn.
            </span>
          </div>
          <div>
            <Link
              href="/login"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Quay lại đăng nhập
            </Link>
          </div>
        </CardContent>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardContent className="space-y-4 pt-2">
            {serverError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
              >
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{serverError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Địa chỉ Email</Label>
              <div className="relative">
                <Mail className="size-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="ban@email.com"
                  className="h-10 pl-9 rounded-xl"
                  aria-invalid={!!errors.email}
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p role="alert" className="text-xs text-red-600 font-medium">
                  {errors.email.message}
                </p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 bg-transparent border-t-0 pt-2 pb-6">
            <Button
              type="submit"
              size="lg"
              className="w-full h-11 rounded-full font-semibold cursor-pointer"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Đang gửi..." : "Gửi liên kết khôi phục"}
            </Button>
            <Link
              href="/login"
              className="text-xs text-center text-slate-500 hover:text-slate-900"
            >
              Quay lại đăng nhập
            </Link>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}
