"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Calendar,
  Plus,
  User,
  Ticket,
  ExternalLink,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { Logo } from "@/shared/ui/logo";
import { useSession } from "@/features/identity";

export function OrganizerHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isEventsActive =
    pathname.startsWith("/organizer/events") &&
    pathname !== "/organizer/events/new";
  const isCreatePage = pathname.startsWith("/organizer/events/new");

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-xs">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: Logo + Organizer Portal Nav */}
        <div className="flex items-center gap-4 sm:gap-6">
          <Logo />
          <span
            className="h-4 w-px bg-border hidden sm:block"
            aria-hidden="true"
          />

          <nav
            aria-label="Điều hướng chính Ban tổ chức"
            className="flex items-center gap-1 text-sm font-medium"
          >
            <Link
              href="/organizer/events"
              className={`inline-flex items-center gap-1.5 h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-md text-xs sm:text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                isEventsActive
                  ? "bg-secondary text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
            >
              <Calendar className="size-3.5 sm:size-4" />
              <span>Sự kiện</span>
            </Link>
            <Link
              href="/organizer/dashboard"
              className="rounded-md px-2 py-2 text-xs sm:text-sm hover:bg-secondary"
              aria-current={
                pathname === "/organizer/dashboard" ? "page" : undefined
              }
            >
              Báo cáo & vận hành
            </Link>
          </nav>
        </div>

        {/* Right: Account Menu Dropdown + Single Primary Create Action */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Account Menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              id="organizer-account-button"
              aria-haspopup="true"
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 h-9 sm:h-10 px-2 sm:px-3 rounded-md border border-border bg-background hover:bg-secondary/60 text-xs sm:text-sm font-medium text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
            >
              <div className="size-5 sm:size-6 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
                <User className="size-3 sm:size-3.5" />
              </div>
              <span className="hidden md:inline text-xs font-semibold">
                {user?.fullName || "Ban Tổ Chức"}
              </span>
              <ChevronDown
                className={`size-3 sm:size-3.5 text-muted-foreground transition-transform duration-200 ${
                  isMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isMenuOpen && (
              <div
                role="menu"
                aria-orientation="vertical"
                aria-labelledby="organizer-account-button"
                className="absolute right-0 mt-1.5 w-60 rounded-md border border-border bg-popover text-popover-foreground shadow-md py-1.5 z-40 focus:outline-none"
              >
                <Link
                  href="/organizer/profile"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-3.5 py-2 border-b border-border hover:bg-secondary transition-colors"
                >
                  <p className="text-xs font-bold text-foreground">
                    Hồ sơ Ban Tổ Chức
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email || "organizer@tickethub.vn"}
                  </p>
                </Link>

                <div className="py-1">
                  <Link
                    href="/my-tickets"
                    role="menuitem"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
                  >
                    <Ticket className="size-3.5 text-muted-foreground" />
                    <span>Vé của tôi (Người mua)</span>
                  </Link>

                  <Link
                    href="/"
                    role="menuitem"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
                  >
                    <ExternalLink className="size-3.5 text-muted-foreground" />
                    <span>Trang mua vé công khai</span>
                  </Link>

                  <Link
                    href="/organizer/settings"
                    role="menuitem"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
                  >
                    <Settings className="size-3.5 text-muted-foreground" />
                    <span>Cài đặt tài khoản</span>
                  </Link>
                </div>

                <div className="border-t border-border pt-1">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={async () => {
                      setIsMenuOpen(false);
                      await logout();
                      router.push("/auth");
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors text-left cursor-pointer"
                  >
                    <LogOut className="size-3.5" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Exactly one primary CTA in the header (hidden on create page) */}
          {!isCreatePage && (
            <Link
              href="/organizer/events/new"
              className="inline-flex items-center justify-center gap-1.5 h-9 sm:h-10 px-3 sm:px-4 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm font-semibold shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shrink-0"
            >
              <Plus className="size-3.5 sm:size-4" />
              <span className="hidden sm:inline">Tạo sự kiện</span>
              <span className="sm:hidden">Tạo</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
