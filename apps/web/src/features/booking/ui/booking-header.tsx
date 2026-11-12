"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, ChevronDown, ShieldCheck, User, Search } from "lucide-react";
import type { BookingScreen } from "./use-booking-screen";

/** Thanh dau trang: thong tin su kien, tim kiem va tai khoan. */
export function BookingHeader({ vm }: { vm: BookingScreen }) {
  const { event, user, isAdmin, isOrganizer, isSaved, setIsSaved } = vm;

  return (
    <header className="h-[64px] border-b border-[#dfe3e5] bg-white px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0 z-30">
      {/* Left: Event thumbnail + Title + Date & Venue */}
      <div className="flex items-center gap-3.5 min-w-0">
        <Link
          href="/"
          className="size-11 rounded-[8px] overflow-hidden bg-[#eff1f2] shrink-0 border border-[#dfe3e5] hover:opacity-90 transition-opacity"
          title="Về trang chủ"
        >
          <Image
            src={event.image}
            alt={event.title}
            width={44}
            height={44}
            unoptimized
            className="w-full h-full object-cover"
          />
        </Link>

        <div className="min-w-0">
          <h1 className="text-[15px] sm:text-[16px] font-bold text-[#141d23] truncate leading-tight">
            {event.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 text-[12px] text-[#606970] truncate pt-0.5">
            <span>{event.fullDateTime}</span>
            <span className="hidden sm:inline text-[#cbd5e1]">•</span>
            <span className="hidden sm:inline truncate text-[#868f97]">
              {event.venue}, {event.city}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsSaved(!isSaved)}
          aria-label={isSaved ? "Bỏ lưu sự kiện" : "Lưu vào yêu thích"}
          className="size-8 rounded-full border border-[#dfe3e5] hover:bg-[#f5f7f8] flex items-center justify-center text-[#141d23] transition-colors ml-1 shrink-0"
        >
          <Heart
            className={`size-4 ${
              isSaved ? "fill-primary text-primary" : "text-[#606970]"
            }`}
          />
        </button>
      </div>

      {/* Center: Global Search Bar */}
      <div className="hidden md:flex flex-1 max-w-md mx-4">
        <div className="w-full h-10 px-4 rounded-full bg-[#f5f7f8] border border-[#dfe3e5] text-[13px] text-[#606970] flex items-center gap-2.5 focus-within:border-primary focus-within:bg-white transition-all">
          <Search className="size-4 text-[#868f97] shrink-0" />
          <input
            type="text"
            placeholder="Tìm kiếm sự kiện, nghệ sĩ, địa điểm..."
            className="w-full bg-transparent border-none outline-none text-[#141d23] placeholder:text-[#868f97]"
          />
        </div>
      </div>

      {/* Right: Region + Links + User Profile */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0 text-[13px] font-medium text-[#141d23]">
        <div className="hidden lg:flex items-center gap-1 text-[#606970] hover:text-[#141d23] cursor-pointer">
          <span>VND | VI</span>
          <ChevronDown className="size-3.5" />
        </div>

        {isAdmin && (
          <Link
            href="/admin"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-700 font-semibold text-xs hover:bg-rose-100 transition-colors"
          >
            <ShieldCheck className="size-3.5" />
            <span>Cổng Quản trị</span>
          </Link>
        )}

        {isOrganizer && (
          <>
            <Link
              href="/organizer/events"
              className="hidden sm:inline-block hover:text-primary transition-colors text-[13px]"
            >
              Quản lý sự kiện
            </Link>
            <Link
              href="/organizer/events/new"
              className="hidden sm:inline-flex items-center gap-1 text-emerald-600 font-semibold hover:text-emerald-700 transition-colors text-[13px]"
            >
              <span>Tạo sự kiện</span>
            </Link>
          </>
        )}

        {(!user || user.role === "BUYER") && (
          <>
            <Link
              href="/register?role=ORGANIZER"
              className="hidden sm:inline-block hover:text-primary transition-colors text-[13px]"
            >
              Bán vé
            </Link>
            <Link
              href="/my-tickets"
              className="hover:text-primary transition-colors text-[13px]"
            >
              Vé của tôi
            </Link>
          </>
        )}

        {/* Auth State */}
        {!user ? (
          <>
            <Link
              href="/auth"
              className="hidden sm:inline-block hover:text-primary transition-colors text-[13px]"
            >
              Đăng nhập
            </Link>
            <Link
              href="/auth"
              aria-label="Đăng nhập"
              className="size-8 rounded-full bg-[#eff1f2] hover:bg-emerald-50 hover:text-primary flex items-center justify-center text-[#141d23] transition-colors shrink-0"
            >
              <User className="size-4 fill-current" />
            </Link>
          </>
        ) : (
          <Link
            href={
              isAdmin
                ? "/admin"
                : isOrganizer
                  ? "/organizer/events"
                  : "/my-tickets"
            }
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-[#141d23] transition-colors"
          >
            <div className="size-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center">
              {user.fullName ? user.fullName.charAt(0).toUpperCase() : "U"}
            </div>
            <span className="max-w-[100px] truncate">
              {user.fullName || user.email}
            </span>
          </Link>
        )}
      </div>
    </header>
  );
}
