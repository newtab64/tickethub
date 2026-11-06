"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { useAuthContext } from "./auth-context";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { roleTab } = useAuthContext();

  const isAuthRoute =
    pathname === "/auth" || pathname === "/login" || pathname === "/register";
  const isBuyerActive = roleTab === "BUYER";

  return (
    <div className="min-h-[100dvh] flex flex-col justify-between bg-background text-foreground selection:bg-primary/20">
      {/* Main Two-Column Container */}
      <div className="flex-1 flex flex-col lg:flex-row items-stretch">
        {/* ========================================================
            LEFT COLUMN: Header, Form (Shared Top Offset), Footer
            Logo and form share the exact same left edge.
            Header row matches the form column width and padding.
            Title placed at one token-based distance below header.
            Footer pinned to bottom.
            ======================================================== */}
        <div className="w-full lg:w-[48%] xl:w-[45%] 2xl:w-[42%] flex flex-col justify-between px-6 sm:px-8 lg:px-12 shrink-0 min-h-[100dvh]">
          {/* Header row: shares exact width and alignment with the form container, real top padding >= 24px */}
          <header className="pt-6 sm:pt-8 pb-2 h-16 sm:h-20 flex items-center justify-between w-full max-w-[440px] mx-auto shrink-0">
            <Logo />
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1.5 py-1"
            >
              <ArrowLeft className="size-4" />
              <span>Quay lại khám phá</span>
            </Link>
          </header>

          {/* Main Zone: flex: 1, flex column, justify-content: center, padding-block >= 24px */}
          <main className="flex-1 flex flex-col justify-center items-center w-full py-6 min-h-0">
            {children}
          </main>

          {/* Footer: fixed to the bottom of the left column with clearance */}
          <footer className="h-12 flex items-center justify-center text-xs text-muted-foreground w-full max-w-[440px] mx-auto shrink-0 pb-2">
            © 2026 tickethub Vietnam
          </footer>
        </div>

        {/* ========================================================
            RIGHT COLUMN: Full-Bleed Photo Panel (Desktop >= 1024px)
            Hidden completely below 1024px.
            Token-based scrim with contrast >= 4.5:1.
            Crossfade on role tab change (respects reduced-motion).
            ======================================================== */}
        <aside
          aria-label="Hình ảnh giới thiệu"
          className="hidden lg:relative lg:flex flex-1 overflow-hidden select-none bg-muted"
        >
          {/* Main Auth Routes (Dual image layers for Buyer & Organizer with crossfade) */}
          {isAuthRoute && (
            <>
              {/* Buyer Image & Overlay */}
              <div
                className={`absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none ${
                  isBuyerActive
                    ? "opacity-100 z-10"
                    : "opacity-0 z-0 pointer-events-none"
                }`}
              >
                <picture>
                  <source
                    media="(min-width: 1024px)"
                    type="image/avif"
                    srcSet="/images/auth/auth-buyer.avif"
                  />
                  <source
                    media="(min-width: 1024px)"
                    type="image/webp"
                    srcSet="/images/auth/auth-buyer.webp"
                  />
                  <source
                    media="(min-width: 1024px)"
                    type="image/jpeg"
                    srcSet="/images/auth/auth-buyer.jpg"
                  />
                  <img
                    src="/images/auth/auth-buyer.webp"
                    alt=""
                    aria-hidden="true"
                    width={1200}
                    height={900}
                    fetchPriority={isBuyerActive ? "high" : "low"}
                    className="size-full object-cover object-center pointer-events-none"
                  />
                </picture>

                {/* Token-based gradient scrim for contrast >= 4.5:1 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

                {/* Overlay Text Block */}
                <div className="absolute inset-x-0 bottom-0 p-8 sm:p-10 lg:p-12 space-y-2 z-10">
                  <h2 className="text-2xl xl:text-3xl font-bold tracking-tight text-white leading-tight">
                    Đặt vé nhanh, vào cửa bằng mã QR
                  </h2>
                  <p className="text-sm xl:text-base text-white/90 leading-relaxed max-w-[480px]">
                    Xem vé đã mua và giữ chỗ trực tiếp trên sơ đồ.
                  </p>
                </div>
              </div>

              {/* Organizer Image & Overlay */}
              <div
                className={`absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none ${
                  !isBuyerActive
                    ? "opacity-100 z-10"
                    : "opacity-0 z-0 pointer-events-none"
                }`}
              >
                <picture>
                  <source
                    media="(min-width: 1024px)"
                    type="image/avif"
                    srcSet="/images/auth/auth-organizer.avif"
                  />
                  <source
                    media="(min-width: 1024px)"
                    type="image/webp"
                    srcSet="/images/auth/auth-organizer.webp"
                  />
                  <source
                    media="(min-width: 1024px)"
                    type="image/jpeg"
                    srcSet="/images/auth/auth-organizer.jpg"
                  />
                  <img
                    src="/images/auth/auth-organizer.webp"
                    alt=""
                    aria-hidden="true"
                    width={1600}
                    height={900}
                    fetchPriority={!isBuyerActive ? "high" : "low"}
                    className="size-full object-cover object-center pointer-events-none"
                  />
                </picture>

                {/* Token-based gradient scrim for contrast >= 4.5:1 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

                {/* Overlay Text Block */}
                <div className="absolute inset-x-0 bottom-0 p-8 sm:p-10 lg:p-12 space-y-2 z-10">
                  <h2 className="text-2xl xl:text-3xl font-bold tracking-tight text-white leading-tight">
                    Tạo sự kiện, mở bán, theo dõi doanh số
                  </h2>
                  <p className="text-sm xl:text-base text-white/90 leading-relaxed max-w-[480px]">
                    Quản lý toàn bộ sự kiện của bạn tại một nơi.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Fallback for other auth pages (Forgot Password, Verify Email) */}
          {!isAuthRoute && (
            <div className="absolute inset-0">
              <picture>
                <source
                  media="(min-width: 1024px)"
                  type="image/avif"
                  srcSet="/images/auth/auth-buyer.avif"
                />
                <source
                  media="(min-width: 1024px)"
                  type="image/webp"
                  srcSet="/images/auth/auth-buyer.webp"
                />
                <source
                  media="(min-width: 1024px)"
                  type="image/jpeg"
                  srcSet="/images/auth/auth-buyer.jpg"
                />
                <img
                  src="/images/auth/auth-buyer.webp"
                  alt=""
                  aria-hidden="true"
                  width={1200}
                  height={900}
                  fetchPriority="high"
                  className="size-full object-cover object-center pointer-events-none"
                />
              </picture>

              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

              <div className="absolute inset-x-0 bottom-0 p-8 sm:p-10 lg:p-12 space-y-2 z-10">
                <h2 className="text-2xl xl:text-3xl font-bold tracking-tight text-white leading-tight">
                  Xác thực tài khoản
                </h2>
                <p className="text-sm xl:text-base text-white/90 leading-relaxed max-w-[480px]">
                  Bảo vệ thông tin cá nhân và vé điện tử của bạn.
                </p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
