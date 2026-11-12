// apps/web/src/app/(auth)/verify-email/page.tsx
"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MailCheck, CheckCircle2, AlertCircle } from "lucide-react";
import { verifyEmailSchema, VerifyEmailInput } from "../domain/auth-schemas";
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

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email") || "email của bạn";
  const initialToken = searchParams.get("token") || "";

  const [verified, setVerified] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(60);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyEmailInput>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: {
      token: initialToken,
    },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const submitToken = useCallback(
    async (tokenValue: string) => {
      try {
        await authApi.verifyEmail({ token: tokenValue });
        setServerError(null);
        setVerified(true);
        setTimeout(() => router.push("/login"), 1800);
      } catch (err) {
        if (err instanceof ApiError) {
          setServerError(err.message);
        } else {
          setServerError(
            "Không thể kiểm tra mã xác thực lúc này. Vui lòng thử lại sau.",
          );
        }
      }
    },
    [router],
  );

  useEffect(() => {
    const cleanToken = initialToken.trim();
    if (!cleanToken) return;
    let cancelled = false;
    authApi
      .verifyEmail({ token: cleanToken })
      .then(() => {
        if (cancelled) return;
        setServerError(null);
        setVerified(true);
        setTimeout(() => router.push("/login"), 1800);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setServerError(err.message);
        } else {
          setServerError(
            "Không thể kiểm tra mã xác thực lúc này. Vui lòng thử lại sau.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [initialToken, router]);

  const onSubmit = async (data: VerifyEmailInput) => {
    setServerError(null);
    await submitToken(data.token);
  };

  const handleResend = () => {
    if (cooldown > 0) return;
    setCooldown(60);
    setResendMessage("Đã gửi lại mã xác thực mới tới hộp thư của bạn.");
  };

  return (
    <Card className="shadow-lg shadow-slate-900/5 border-slate-200/90 rounded-2xl bg-white">
      <CardHeader className="text-center space-y-2 pb-2">
        <div className="mx-auto size-11 rounded-full bg-emerald-50 border border-emerald-200/80 text-primary flex items-center justify-center">
          <MailCheck className="size-5" />
        </div>
        <CardTitle className="text-2xl font-bold text-slate-900">
          Xác thực địa chỉ Email
        </CardTitle>
        <CardDescription className="text-slate-500">
          Chúng tôi đã gửi mã kích hoạt tới{" "}
          <strong className="text-slate-800">{email}</strong>
        </CardDescription>
      </CardHeader>

      {verified ? (
        <CardContent className="py-6 text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="size-5 shrink-0" />
            <span>
              Tài khoản đã kích hoạt thành công! Đang chuyển về trang đăng
              nhập...
            </span>
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

            {resendMessage && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-700">
                {resendMessage}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="token">Mã kích hoạt</Label>
              <Input
                id="token"
                placeholder="Nhập mã xác thực từ email..."
                className="h-10 text-center font-mono rounded-xl"
                aria-invalid={!!errors.token}
                {...register("token")}
              />
              {errors.token && (
                <p
                  role="alert"
                  className="text-xs text-red-600 font-medium text-center"
                >
                  {errors.token.message}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Chưa nhận được thư?</span>
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0}
                className="font-semibold text-primary disabled:text-slate-400 hover:underline disabled:no-underline cursor-pointer disabled:cursor-not-allowed"
              >
                {cooldown > 0 ? `Gửi lại sau ${cooldown}s` : "Gửi lại mã"}
              </button>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 bg-transparent border-t-0 pt-2 pb-6">
            <Button
              type="submit"
              size="lg"
              className="w-full h-11 rounded-full font-semibold cursor-pointer"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Đang kiểm tra..." : "Xác nhận kích hoạt"}
            </Button>
            <div className="text-xs text-center text-slate-500">
              Quay lại{" "}
              <Link
                href="/login"
                className="text-primary font-semibold hover:underline"
              >
                Trang đăng nhập
              </Link>
            </div>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}

export function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center text-sm text-slate-500">Đang tải...</div>
      }
    >
      <VerifyEmailForm />
    </Suspense>
  );
}
