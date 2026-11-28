"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { fetchPublicEvents } from "../api/public-events";
import {
  filterEventCards,
  toEventCards,
  type EventCard,
} from "../domain/event-discovery";
import { formatEventDateTime } from "../domain/event-format";
import { EventPoster } from "./event-poster";

const MAX_SUGGESTIONS = 5;

// Biểu tượng tìm kiếm trên header; bấm sẽ trượt mở thanh tìm kiếm ngay trong thanh header.
// Phải đặt bên trong một phần tử cha có position: relative (thanh header đang nổi).
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

  // Đọc danh sách khi mở lần đầu; lỗi thì lần mở sau thử lại.
  const [events, setEvents] = useState<EventCard[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!open || events) return;
    let ignore = false;
    fetchPublicEvents()
      .then((list) => {
        if (!ignore) setEvents(toEventCards(list, Date.now()));
      })
      .catch(() => {
        if (!ignore) setFailed(true);
      });
    return () => {
      ignore = true;
    };
  }, [open, events]);

  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    // Không lọc theo ngày nên không cần mốc thời gian.
    return filterEventCards(
      events ?? [],
      { category: "ALL", city: null, date: "ALL", query },
      0,
    ).slice(0, MAX_SUGGESTIONS);
  }, [events, query]);

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
        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-fill aria-expanded:bg-fill motion-reduce:transition-none"
      >
        <Search className="size-5" />
      </button>

      {open && (
        <div
          id="header-search-panel"
          role="search"
          className="header-search-slide absolute inset-0 z-10 rounded-full bg-background"
        >
          <form
            onSubmit={submit}
            className="flex h-full items-center gap-3 pr-1.5 pl-6"
          >
            <Search className="size-5 shrink-0 text-muted-foreground" />
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
              className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-fill hover:bg-fill-hover"
            >
              <X className="size-4" />
            </button>
          </form>

          {query.trim() && (
            <ul className="absolute top-[calc(100%+8px)] right-4 left-4 rounded-3xl bg-popover p-2 shadow-sheet ring-1 ring-foreground/5">
              {suggestions.map((ev) => (
                <li key={ev.id}>
                  <Link
                    href={`/events/${ev.slug}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-2xl px-3 py-2 hover:bg-muted"
                  >
                    <span className="relative size-10 shrink-0 overflow-hidden rounded-2xl bg-muted">
                      <EventPoster event={ev} sizes="40px" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-semibold text-foreground">
                        {ev.title}
                      </span>
                      <span className="block truncate text-[13px] text-muted-foreground">
                        {formatEventDateTime(ev.startTime)} | {ev.venueName},{" "}
                        {ev.city}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
              {suggestions.length === 0 && (
                <li className="p-3 text-[13px] text-muted-foreground">
                  {events
                    ? "Không có sự kiện phù hợp. Nhấn Enter để tìm trong danh sách."
                    : failed
                      ? "Không tải được sự kiện. Nhấn Enter để tìm trong danh sách."
                      : "Đang tải sự kiện..."}
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
                    className="min-h-11 w-full cursor-pointer rounded-2xl px-3 text-left text-[15px] font-semibold hover:bg-muted"
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
