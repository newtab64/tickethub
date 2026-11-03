// apps/web/src/components/search/search-autocomplete-bar.tsx
"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X, MapPin, Calendar, ArrowRight } from "lucide-react";
import { EVENTS, type EventItem } from "@/lib/events-catalog";
import { removeVietnameseTones } from "@/lib/api/search";

interface SearchAutocompleteBarProps {
  defaultValue?: string;
  onSubmitSearch?: (keyword: string) => void;
  placeholder?: string;
}

export function SearchAutocompleteBar({
  defaultValue = "",
  onSubmitSearch,
  placeholder = "Tìm sự kiện, nghệ sĩ, đội bóng và địa điểm",
}: SearchAutocompleteBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);
  const [prevDefaultValue, setPrevDefaultValue] = useState(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  if (defaultValue !== prevDefaultValue) {
    setPrevDefaultValue(defaultValue);
    setQuery(defaultValue);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const suggestions: EventItem[] = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const qNorm = removeVietnameseTones(trimmed);

    return EVENTS.filter((ev) => {
      const haystack = removeVietnameseTones(
        `${ev.title} ${ev.venue} ${ev.city} ${ev.organizerName}`,
      );
      return haystack.includes(qNorm);
    }).slice(0, 5);
  }, [query]);

  const triggerNavigateToSearch = (rawKeyword: string) => {
    setIsOpen(false);
    const trimmed = rawKeyword.trim();
    if (onSubmitSearch) {
      onSubmitSearch(trimmed);
      return;
    }
    if (trimmed) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/search");
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeIndex >= 0 && activeIndex < suggestions.length) {
      const targetEvent = suggestions[activeIndex];
      if (targetEvent) {
        setIsOpen(false);
        router.push(`/events/${targetEvent.id}`);
        return;
      }
    }
    triggerNavigateToSearch(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > -1 ? prev - 1 : suggestions.length - 1));
    }
  };

  return (
    <div ref={containerRef} className="relative max-w-[760px] mx-auto z-30">
      <form
        onSubmit={handleFormSubmit}
        role="search"
        className="relative flex items-center bg-background rounded-full h-[50px] px-5 border border-border shadow-[0_4px_16px_rgba(0,0,0,0.08)] focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all"
      >
        <Search className="size-4.5 text-primary shrink-0 mr-3" />
        <input
          type="text"
          role="combobox"
          value={query}
          onFocus={() => {
            if (query.trim().length > 0) setIsOpen(true);
          }}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            setActiveIndex(-1);
            setIsOpen(val.trim().length > 0);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls="search-suggestions-listbox"
          data-testid="search-keyword-input"
          className="w-full bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setIsOpen(false);
              if (onSubmitSearch) onSubmitSearch("");
            }}
            aria-label="Xóa tìm kiếm"
            className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="size-4" />
          </button>
        )}
      </form>

      {isOpen && query.trim().length > 0 && (
        <div
          id="search-suggestions-listbox"
          role="listbox"
          data-testid="search-suggestions-dropdown"
          className="absolute left-0 right-0 mt-2 rounded-[16px] border border-border bg-background shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-4 py-2 bg-muted border-b border-secondary flex items-center justify-between text-[11.5px] font-semibold text-muted-foreground">
            <span>Gợi ý nhanh cho &ldquo;{query.trim()}&rdquo;</span>
            <span>Nhấn Enter để tìm tất cả</span>
          </div>

          {suggestions.length === 0 ? (
            <div className="p-4 text-center text-[13px] text-muted-foreground">
              Không có gợi ý nhanh trùng khớp. Nhấn{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-secondary text-foreground font-mono text-[11px]">
                Enter
              </kbd>{" "}
              để tìm kiếm nâng cao trên toàn hệ thống.
            </div>
          ) : (
            <ul className="divide-y divide-secondary">
              {suggestions.map((ev, idx) => {
                const isHighlighted = idx === activeIndex;
                return (
                  <li key={ev.id} role="option" aria-selected={isHighlighted}>
                    <Link
                      href={`/events/${ev.id}`}
                      onClick={() => setIsOpen(false)}
                      data-testid="search-suggestion-item"
                      className={`flex items-center justify-between gap-3 px-4 py-2.5 transition-colors ${
                        isHighlighted ? "bg-emerald-50/70" : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Image
                          src={ev.image}
                          alt={ev.title}
                          width={40}
                          height={40}
                          className="size-10 rounded-[8px] object-cover shrink-0 border border-border"
                        />
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-bold text-foreground truncate">
                            {ev.title}
                          </p>
                          <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground truncate">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="size-3" />
                              {ev.dateRange}
                            </span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1 truncate">
                              <MapPin className="size-3" />
                              {ev.city}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[12.5px] font-bold text-primary">
                          {ev.fromPrice}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={() => triggerNavigateToSearch(query)}
            data-testid="search-view-all-results-btn"
            className="w-full px-4 py-2.5 bg-muted hover:bg-emerald-50/60 border-t border-border text-[13px] font-bold text-primary flex items-center justify-between transition-colors cursor-pointer"
          >
            <span>
              Xem tất cả kết quả tìm kiếm cho &ldquo;{query.trim()}&rdquo;
            </span>
            <ArrowRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
