"use client";

import Link from "next/link";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, User } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import type { AuthFlow } from "./use-auth-flow";

/** Buoc 2a: tai khoan da ton tai, nhap mat khau. */
export function PasswordStep({ flow }: { flow: AuthFlow }) {
  const {
    identifier,
    showPassword,
    setShowPassword,
    loginError,
    rememberMe,
    setRememberMe,
    passwordInputRef,
    registerPass,
    handlePassSubmit,
    passErrors,
    isLoggingIn,
    handleBackToIdentifier,
    onPasswordSubmit,
  } = flow;

  return (
    <div className="col-start-1 row-start-1 w-full self-start flex flex-col gap-7 animate-in fade-in-50 duration-200 motion-reduce:animate-none">
      <header className="flex flex-col gap-2 text-left">
        <h1 className="text-[28px] leading-8 font-semibold tracking-tight text-foreground">
          Chào mừng trở lại
        </h1>
        <p className="text-base text-muted-foreground leading-normal">
          Nhập mật khẩu để đăng nhập vào tài khoản của bạn.
        </p>
      </header>

      <form
        onSubmit={handlePassSubmit(onPasswordSubmit)}
        noValidate
        className="flex flex-col gap-6"
      >
        {/* Visually hidden username for password managers */}
        <input
          type="text"
          name="username"
          value={identifier}
          autoComplete="username"
          readOnly
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />

        <div className="flex flex-col gap-5">
          {/* Identifier Chip Row (48px tall, neutral surface, "Đổi" button) */}
          <div
            data-slot="identifier-chip"
            className="h-12 w-full flex items-center justify-between px-3.5 rounded-lg border border-border bg-muted/50 text-foreground"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <User className="size-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate text-foreground">
                {identifier}
              </span>
            </div>
            <button
              type="button"
              onClick={handleBackToIdentifier}
              className="h-11 px-2.5 text-sm font-semibold text-primary hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md shrink-0 flex items-center"
              aria-label={`Thay đổi tài khoản ${identifier}`}
            >
              Đổi
            </button>
          </div>

          {/* Password field */}
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between w-full">
              <Label
                htmlFor="password"
                className="text-sm font-medium text-foreground"
              >
                Mật khẩu
              </Label>
              <Link
                href="/forgot-password"
                className="text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xs"
              >
                Quên mật khẩu?
              </Link>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="relative">
                <Lock className="size-5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  {...registerPass("password")}
                  ref={(e) => {
                    registerPass("password").ref(e);
                    passwordInputRef.current = e;
                  }}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  aria-required="true"
                  placeholder="Nhập mật khẩu"
                  className={`h-12 pl-11 pr-11 rounded-lg text-base bg-background text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 transition-colors ${
                    passErrors.password || loginError
                      ? "border-destructive focus-visible:border-destructive"
                      : "border border-muted-foreground hover:border-foreground"
                  }`}
                  aria-invalid={!!passErrors.password || !!loginError}
                  aria-describedby={
                    passErrors.password ? "password-error" : undefined
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xs p-1"
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? (
                    <EyeOff className="size-5" />
                  ) : (
                    <Eye className="size-5" />
                  )}
                </button>
              </div>
              {passErrors.password && (
                <p
                  id="password-error"
                  role="alert"
                  className="flex items-center gap-1.5 text-[13px] text-destructive font-medium"
                >
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span>{passErrors.password.message}</span>
                </p>
              )}
            </div>
          </div>

          {/* Remember me checkbox (whole row 44px click target, box >= 20px) */}
          <div
            id="rememberMe-row"
            className="h-11 flex items-center gap-3 select-none"
          >
            <input
              id="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="size-5 rounded-xs border-muted-foreground text-primary focus-visible:ring-2 focus-visible:ring-ring cursor-pointer accent-primary shrink-0"
            />
            <label
              htmlFor="rememberMe"
              className="text-sm text-foreground font-medium cursor-pointer"
            >
              Ghi nhớ đăng nhập
            </label>
          </div>
        </div>

        {/* Submit & Error Alert */}
        <div className="flex flex-col gap-3">
          {loginError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs sm:text-[13px] font-medium text-destructive"
            >
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoggingIn}
            className="w-full h-12 rounded-lg font-semibold text-base bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50"
          >
            {isLoggingIn ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-5 animate-spin" />
                <span>Đang đăng nhập...</span>
              </span>
            ) : (
              "Đăng nhập"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
