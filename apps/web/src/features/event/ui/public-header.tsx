"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LogOut,
  Calendar,
  Plus,
  Building2,
  ShieldCheck,
  Ticket,
  ChevronDown,
} from "lucide-react";
import { Logo } from "@/shared/ui/logo";
import { useSession } from "@/features/identity";
import { getEventById } from "../api/event-catalog";
import { type CategoryCode } from "../domain/event.types";
import { HeaderSearch } from "./header-search";
import { Badge } from "@/shared/ui/badge";

const NAV_CATEGORIES: { code: CategoryCode; label: string }[] = [
  { code: "SPORT", label: "Thể thao" },
  { code: "CONCERT", label: "Hòa nhạc" },
  { code: "THEATER", label: "Sân khấu & Hài kịch" },
];

export function PublicHeader() {
  return (
    <Suspense fallback={null}>
      <PublicHeaderInner />
    </Suspense>
  );
}

function PublicHeaderInner() {
  const pathname = usePathname();
  const categoryParam = useSearchParams().get("category");
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const eventId = pathname.startsWith("/events/")
    ? pathname.split("/")[2]
    : undefined;
  const activeCategory: string | null =
    pathname === "/"
      ? categoryParam
      : eventId
        ? (getEventById(eventId)?.category ?? null)
        : null;

  const handleLogout = async () => {
    setIsDropdownOpen(false);
    await logout();
    router.push("/auth");
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "ADMIN":
        return (
          <Badge
            variant="outline"
            className="border-rose-300 bg-rose-50 text-rose-700 text-[10px] font-semibold"
          >
            Quản trị viên
          </Badge>
        );
      case "ORGANIZER":
        return (
          <Badge
            variant="outline"
            className="border-emerald-300 bg-emerald-50 text-emerald-700 text-[10px] font-semibold"
          >
            Ban tổ chức
          </Badge>
        );
      case "GATE_STAFF":
        return (
          <Badge
            variant="outline"
            className="border-blue-300 bg-blue-50 text-blue-700 text-[10px] font-semibold"
          >
            Soát vé cổng
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="border-slate-300 bg-slate-50 text-slate-700 text-[10px] font-semibold"
          >
            Người mua vé
          </Badge>
        );
    }
  };

  return (
    <header className="sticky top-3 z-30 mt-3 -mb-[68px] px-3 sm:px-6 pointer-events-none">
      <div className="pointer-events-auto relative max-w-[1200px] mx-auto h-14 rounded-full bg-white shadow-[0_8px_24px_rgba(0,0,0,0.18)] ring-1 ring-black/5 pl-5 sm:pl-6 pr-2 flex items-center justify-between gap-4">
        {/* Left: Brand & Categories */}
        <div className="flex items-center gap-6">
          <Logo />

          <nav
            aria-label="Danh mục chính"
            className="hidden md:flex items-center gap-1 text-[13.5px] font-medium text-foreground"
          >
            {NAV_CATEGORIES.map((c) => {
              const active = activeCategory === c.code;
              return (
                <Link
                  key={c.code}
                  href={`/?category=${c.code}#events-list`}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex h-9 items-center rounded-full px-3.5 transition-colors ${
                    active
                      ? "bg-emerald-50 text-primary font-semibold"
                      : "hover:bg-slate-100 hover:text-primary"
                  }`}
                >
                  {c.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Actions & User Profile */}
        <div className="flex items-center gap-4 sm:gap-5 text-[13.5px] font-medium text-[#141d23]">
          <HeaderSearch />

          {/* Role-specific portal actions */}
          {user?.role === "ADMIN" && (
            <Link
              href="/admin"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-semibold text-xs hover:bg-rose-100 transition-colors"
            >
              <ShieldCheck className="size-3.5" />
              <span>Cổng Quản trị</span>
            </Link>
          )}

          {user?.role === "ORGANIZER" && (
            <>
              <Link
                href="/organizer/events"
                className="hidden sm:inline-block hover:text-primary transition-colors font-medium"
              >
                Quản lý sự kiện
              </Link>
              <Link
                href="/organizer/events/new"
                className="hidden sm:inline-flex items-center gap-1 text-emerald-600 font-semibold hover:text-emerald-700 transition-colors"
              >
                <Plus className="size-3.5" />
                <span>Tạo sự kiện</span>
              </Link>
            </>
          )}

          {(!user || user.role === "BUYER") && (
            <Link
              href="/register?role=ORGANIZER"
              className="hidden sm:inline-block hover:text-primary transition-colors"
            >
              Bán vé
            </Link>
          )}

          {/* Ticket buying is strictly reserved for BUYER / GUEST */}
          {(!user || user.role === "BUYER") && (
            <Link
              href="/my-tickets"
              className="hidden sm:inline-block hover:text-primary transition-colors"
            >
              Vé của tôi
            </Link>
          )}

          {/* Auth State */}
          {!isLoading && !isAuthenticated && (
            <div className="flex items-center gap-3">
              <Link
                href="/auth"
                className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-[13px] font-bold text-white hover:bg-emerald-700 transition-colors"
              >
                Đăng nhập
              </Link>
            </div>
          )}

          {!isLoading && isAuthenticated && user && (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                id="user-account-menu-button"
                aria-haspopup="true"
                aria-expanded={isDropdownOpen}
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 h-9 px-2.5 rounded-lg border border-border bg-white hover:bg-slate-50 text-xs sm:text-sm font-medium text-[#141d23] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
              >
                <div className="size-6 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                  {user.fullName ? user.fullName.charAt(0).toUpperCase() : "U"}
                </div>
                <span className="max-w-[120px] sm:max-w-[160px] truncate font-medium text-left">
                  {user.fullName || user.email}
                </span>
                <ChevronDown
                  className={`size-3.5 text-muted-foreground transition-transform duration-200 ${
                    isDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isDropdownOpen && (
                <div
                  role="menu"
                  aria-orientation="vertical"
                  aria-labelledby="user-account-menu-button"
                  className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-white p-2 shadow-lg z-50 text-xs animate-in fade-in zoom-in-95 duration-100"
                >
                  {/* User Profile Header */}
                  <div className="px-3 py-2.5 border-b border-border mb-1">
                    <p className="font-semibold text-foreground text-sm truncate">
                      {user.fullName}
                    </p>
                    <p className="text-muted-foreground text-xs truncate mt-0.5">
                      {user.email}
                    </p>
                    <div className="mt-2">{getRoleBadge(user.role)}</div>
                  </div>

                  {/* Role-specific Navigation */}
                  <div className="py-1 space-y-0.5">
                    {user.role === "ADMIN" && (
                      <Link
                        href="/admin"
                        role="menuitem"
                        onClick={() => setIsDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-foreground hover:bg-slate-100 transition-colors"
                      >
                        <ShieldCheck className="size-4 text-rose-600" />
                        <span>Bảng điều khiển Admin</span>
                      </Link>
                    )}

                    {user.role === "ORGANIZER" && (
                      <>
                        <Link
                          href="/organizer/events"
                          role="menuitem"
                          onClick={() => setIsDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-foreground hover:bg-slate-100 transition-colors"
                        >
                          <Calendar className="size-4 text-emerald-600" />
                          <span>Quản lý sự kiện</span>
                        </Link>
                        <Link
                          href="/organizer/events/new"
                          role="menuitem"
                          onClick={() => setIsDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-foreground hover:bg-slate-100 transition-colors"
                        >
                          <Plus className="size-4 text-emerald-600" />
                          <span>Tạo sự kiện mới</span>
                        </Link>
                        <Link
                          href="/organizer/profile"
                          role="menuitem"
                          onClick={() => setIsDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-foreground hover:bg-slate-100 transition-colors"
                        >
                          <Building2 className="size-4 text-emerald-600" />
                          <span>Hồ sơ Ban tổ chức</span>
                        </Link>
                      </>
                    )}

                    {user.role === "BUYER" && (
                      <Link
                        href="/my-tickets"
                        role="menuitem"
                        onClick={() => setIsDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-foreground hover:bg-slate-100 transition-colors"
                      >
                        <Ticket className="size-4 text-slate-600" />
                        <span>Vé của tôi</span>
                      </Link>
                    )}
                  </div>

                  {/* Logout Button */}
                  <div className="border-t border-border pt-1 mt-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer text-left"
                    >
                      <LogOut className="size-4" />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
