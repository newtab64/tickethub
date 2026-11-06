"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { EVENTS } from "@/lib/events-catalog";

const MAX_SUGGESTIONS = 5;

// Bieu tuong tim kiem tren header; bam se truot mo thanh tim kiem ngay trong thanh header.
// Phai dat ben trong mot phan tu cha co position: relative (thanh header dang noi).
export function HeaderSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return EVENTS.filter((ev) =>
      `${ev.title} ${ev.venue} ${ev.city}`.toLowerCase().includes(q),
    ).slice(0, MAX_SUGGESTIONS);
  }, [query]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setOpen(false);
    router.push(`/?q=${encodeURIComponent(q)}#events-list`);
  };

  return (
    <div ref={wrapperRef}>
      <button
        type="button"
        aria-label="Tìm kiếm sự kiện"
        aria-expanded={open}
        aria-controls="header-search-panel"
        onClick={() => setOpen((prev) => !prev)}
        className={`size-9 rounded-full inline-flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          open
            ? "bg-emerald-50 text-primary"
            : "bg-secondary text-foreground hover:bg-slate-200"
        }`}
      >
        <Search className="size-4" />
      </button>

      {open && (
        <div
          id="header-search-panel"
          role="search"
          className="header-search-slide absolute inset-0 z-10 rounded-full bg-white"
        >
          <form
            onSubmit={submit}
            className="flex h-full items-center gap-3 pl-6 pr-2.5"
          >
            <Search className="size-5 shrink-0 text-primary" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm sự kiện, nghệ sĩ, đội bóng và địa điểm"
              aria-label="Tìm sự kiện, nghệ sĩ, đội bóng và địa điểm"
              className="h-full w-full bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button
              type="button"
              aria-label="Đóng tìm kiếm"
              onClick={() => setOpen(false)}
              className="size-9 shrink-0 rounded-full inline-flex items-center justify-center bg-secondary text-foreground hover:bg-slate-200 cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </form>

          {query.trim() && (
            <ul className="absolute left-4 right-4 top-[calc(100%+8px)] rounded-3xl bg-white p-2 shadow-[0_16px_40px_rgba(0,0,0,0.22)] ring-1 ring-black/5">
              {suggestions.map((ev) => (
                <li key={ev.id}>
                  <Link
                    href={`/events/${ev.id}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-slate-50"
                  >
                    <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-secondary">
                      <Image
                        src={ev.image}
                        alt=""
                        fill
                        unoptimized
                        sizes="40px"
                        className="object-cover"
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {ev.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {ev.dateRange} | {ev.venue}, {ev.city}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
              {suggestions.length === 0 && (
                <li className="px-3 py-3 text-sm text-muted-foreground">
                  Không có sự kiện phù hợp. Nhấn Enter để tìm trong danh sách.
                </li>
              )}
              {suggestions.length > 0 && (
                <li className="border-t border-border mt-1 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      router.push(
                        `/?q=${encodeURIComponent(query.trim())}#events-list`,
                      );
                    }}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-primary hover:bg-emerald-50 cursor-pointer"
                  >
                    Xem tất cả kết quả cho &ldquo;{query.trim()}&rdquo;
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
