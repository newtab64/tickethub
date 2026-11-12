"use client";

import { Building2, Eye, Lock, User } from "lucide-react";
import type { AuthFlow } from "./use-auth-flow";

/** Khung an giu chieu cao cua buoc cao nhat de bo cuc khong nhay khi doi buoc. */
export function AuthStageSizer({ flow }: { flow: AuthFlow }) {
  const { identifier } = flow;

  return (
    <div
      data-slot="stage-sizer"
      aria-hidden="true"
      tabIndex={-1}
      className="col-start-1 row-start-1 w-full self-start invisible pointer-events-none select-none flex flex-col gap-7"
    >
      <div className="flex flex-col gap-2 text-left">
        <div className="text-[28px] leading-8 font-semibold tracking-tight text-foreground">
          Tạo tài khoản
        </div>
        <div className="text-base text-muted-foreground leading-normal">
          Đăng ký tài khoản ban tổ chức để bắt đầu tạo sự kiện.
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-5">
          {/* Identifier Chip Row */}
          <div className="h-12 w-full flex items-center justify-between px-3.5 rounded-lg border border-border bg-muted/50 text-foreground">
            <div className="flex items-center gap-2.5 min-w-0">
              <User className="size-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate text-foreground">
                {identifier || "user@example.com"}
              </span>
            </div>
            <span className="h-11 px-2.5 text-sm font-semibold text-primary flex items-center">
              Đổi
            </span>
          </div>

          {/* Full name field */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">
              Họ và tên
            </span>
            <div className="flex flex-col gap-1.5">
              <div className="relative">
                <User className="size-5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <div className="h-12 pl-11 pr-3.5 rounded-lg border border-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Organizer-only field */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">
              Tên Tổ chức / Doanh nghiệp
            </span>
            <div className="flex flex-col gap-1.5">
              <div className="relative">
                <Building2 className="size-5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <div className="h-12 pl-11 pr-3.5 rounded-lg border border-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Password field */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">
              Mật khẩu
            </span>
            <div className="flex flex-col gap-1.5">
              <div className="relative">
                <Lock className="size-5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <div className="h-12 pl-11 pr-11 rounded-lg border border-muted-foreground" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground p-1">
                  <Eye className="size-5" />
                </span>
              </div>
              <div className="flex items-center justify-between text-[13px] text-muted-foreground">
                <span>Tối thiểu 8 ký tự</span>
              </div>
            </div>
          </div>

          {/* Role switch link placeholder */}
          <div className="pt-1">
            <span className="text-xs sm:text-[13px] text-transparent select-none inline-block h-5">
              Role switch link placeholder
            </span>
          </div>
        </div>

        {/* Submit button & Consent line */}
        <div className="flex flex-col gap-3">
          <div className="w-full h-12 rounded-lg font-semibold text-base bg-primary text-primary-foreground flex items-center justify-center">
            Tạo tài khoản
          </div>
          <div className="text-xs text-muted-foreground text-center leading-relaxed">
            Bằng việc tiếp tục, bạn đồng ý với{" "}
            <span className="font-semibold">Điều khoản sử dụng</span> và{" "}
            <span className="font-semibold">Chính sách bảo mật</span>.
          </div>
        </div>
      </div>
    </div>
  );
}
