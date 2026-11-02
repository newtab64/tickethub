// apps/web/src/components/search/search-page-client.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  MapPin,
  ChevronDown,
  Banknote,
  Loader2,
  RotateCcw,
  Sparkles,
  ArrowLeft,
  SlidersHorizontal,
} from "lucide-react";
import { type CategoryCode, type EventItem } from "@/lib/events-catalog";
import {
  searchApi,
  filterCatalogEventsWithCursor,
  type SearchFilterParams,
} from "@/lib/api/search";
import { DateRangePopover } from "@/components/ui/date-range-popover";
import { SearchAutocompleteBar } from "./search-autocomplete-bar";

const PRICE_RANGES = [
  { id: "ALL", label: "Mọi mức giá", minPrice: undefined, maxPrice: undefined },
  { id: "UNDER_500K", label: "Dưới 500.000 ₫", minPrice: 0, maxPrice: 500000 },
  {
    id: "500K_TO_800K",
    label: "500.000 ₫ - 800.000 ₫",
    minPrice: 500000,
    maxPrice: 800000,
  },
  {
    id: "ABOVE_800K",
    label: "Trên 800.000 ₫",
    minPrice: 800000,
    maxPrice: undefined,
  },
] as const;

interface SearchPageClientProps {
  initialKeyword?: string;
  initialCategory?: CategoryCode;
  initialCity?: "ALL" | "HCM" | "HN" | "DN";
  initialPriceRange?: string;
  initialFromDate?: string;
  initialToDate?: string;
}

export function SearchPageClient({
  initialKeyword = "",
  initialCategory = "ALL",
  initialCity = "ALL",
  initialPriceRange = "ALL",
  initialFromDate = "",
  initialToDate = "",
}: SearchPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const urlSearchParams = useSearchParams();

  const [keyword, setKeyword] = useState(initialKeyword);
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryCode>(initialCategory);
  const [selectedCity, setSelectedCity] = useState<"ALL" | "HCM" | "HN" | "DN">(
    initialCity,
  );
  const [selectedPriceRange, setSelectedPriceRange] =
    useState<string>(initialPriceRange);
  const [fromDate, setFromDate] = useState<string>(initialFromDate);
  const [toDate, setToDate] = useState<string>(initialToDate);

  const PAGE_LIMIT = 6;

  const currentPriceObj = useMemo(
    () =>
      PRICE_RANGES.find((r) => r.id === selectedPriceRange) ?? PRICE_RANGES[0],
    [selectedPriceRange],
  );

  const filterParams: SearchFilterParams = useMemo(
    () => ({
      keyword,
      city: selectedCity,
      category: selectedCategory,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      minPrice: currentPriceObj.minPrice,
      maxPrice: currentPriceObj.maxPrice,
      limit: PAGE_LIMIT,
    }),
    [
      keyword,
      selectedCity,
      selectedCategory,
      fromDate,
      toDate,
      currentPriceObj,
    ],
  );

  const initialPage = useMemo(
    () => filterCatalogEventsWithCursor(filterParams),
    [filterParams],
  );

  const [items, setItems] = useState<EventItem[]>(initialPage.items);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialPage.nextCursor,
  );
  const [hasMore, setHasMore] = useState<boolean>(initialPage.hasMore);
  const [totalFiltered, setTotalFiltered] = useState<number>(
    initialPage.totalFiltered ?? initialPage.items.length,
  );
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  useEffect(() => {
    setItems(initialPage.items);
    setNextCursor(initialPage.nextCursor);
    setHasMore(initialPage.hasMore);
    setTotalFiltered(initialPage.totalFiltered ?? initialPage.items.length);

    let isCancelled = false;
    searchApi.searchEvents(filterParams).then((res) => {
      if (!isCancelled) {
        setItems(res.items);
        setNextCursor(res.nextCursor);
        setHasMore(res.hasMore);
        if (res.totalFiltered !== undefined) {
          setTotalFiltered(res.totalFiltered);
        }
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [filterParams, initialPage]);

  useEffect(() => {
    const params = new URLSearchParams(urlSearchParams.toString());
    if (keyword.trim()) params.set("q", keyword.trim());
    else params.delete("q");

    if (selectedCategory !== "ALL") params.set("category", selectedCategory);
    else params.delete("category");

    if (selectedCity !== "ALL") params.set("city", selectedCity);
    else params.delete("city");

    if (selectedPriceRange !== "ALL") params.set("price", selectedPriceRange);
    else params.delete("price");

    if (fromDate) params.set("fromDate", fromDate);
    else params.delete("fromDate");

    if (toDate) params.set("toDate", toDate);
    else params.delete("toDate");

    const nextQuery = params.toString();
    const currentQuery = urlSearchParams.toString();
    if (nextQuery !== currentQuery) {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
        scroll: false,
      });
    }
  }, [
    keyword,
    selectedCategory,
    selectedCity,
    selectedPriceRange,
    fromDate,
    toDate,
    pathname,
    router,
    urlSearchParams,
  ]);

  const handleLoadMoreCursor = async () => {
    if (!hasMore || !nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const nextBatch = await searchApi.searchEvents({
        ...filterParams,
        cursor: nextCursor,
      });
      setItems((prev) => {
        const existingIds = new Set(prev.map((i) => i.id));
        const uniqueNew = nextBatch.items.filter((i) => !existingIds.has(i.id));
        return [...prev, ...uniqueNew];
      });
      setNextCursor(nextBatch.nextCursor);
      setHasMore(nextBatch.hasMore);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleResetFilters = () => {
    setKeyword("");
    setSelectedCategory("ALL");
    setSelectedCity("ALL");
    setSelectedPriceRange("ALL");
    setFromDate("");
    setToDate("");
  };

  const cycleCity = () => {
    const order: Array<"ALL" | "HCM" | "HN" | "DN"> = [
      "ALL",
      "HCM",
      "HN",
      "DN",
    ];
    const next = order[(order.indexOf(selectedCity) + 1) % order.length]!;
    setSelectedCity(next);
  };

  const cyclePriceRange = () => {
    const idx = PRICE_RANGES.findIndex((p) => p.id === selectedPriceRange);
    const next = PRICE_RANGES[(idx + 1) % PRICE_RANGES.length]!;
    setSelectedPriceRange(next.id);
  };

  const cityButtonLabel =
    selectedCity === "HCM"
      ? "TP. Hồ Chí Minh"
      : selectedCity === "HN"
        ? "Hà Nội"
        : selectedCity === "DN"
          ? "Đà Nẵng"
          : "Toàn quốc";

  return (
    <div className="bg-background min-h-[75vh]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 hover:text-primary font-medium transition-colors"
            >
              <ArrowLeft className="size-4" />
              <span>Trang chủ</span>
            </Link>
            <span>/</span>
            <span className="text-foreground font-semibold">
              Tìm kiếm sự kiện
            </span>
          </div>

          <SearchAutocompleteBar
            defaultValue={keyword}
            onSubmitSearch={(newKw) => setKeyword(newKw)}
          />
        </div>

        <div className="py-3 border-y border-secondary flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-foreground mr-1">
            <SlidersHorizontal className="size-3.5 text-primary" />
            <span>Bộ lọc:</span>
          </div>

          <button
            type="button"
            onClick={cycleCity}
            data-testid="filter-city-btn"
            className="h-9 px-3 rounded-[8px] border-[1.5px] border-primary bg-emerald-50/50 text-primary text-[13px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <MapPin className="size-3.5" />
            <span>{cityButtonLabel}</span>
            <ChevronDown className="size-3.5" />
          </button>

          <DateRangePopover
            fromDate={fromDate}
            toDate={toDate}
            onChange={(f, t) => {
              setFromDate(f);
              setToDate(t);
            }}
            className="[&_button]:h-9 [&_button]:rounded-[8px] [&_button]:text-[13px]"
          />

          <button
            type="button"
            onClick={cyclePriceRange}
            data-testid="filter-price-btn"
            className={`h-9 px-3 rounded-[8px] text-[13px] inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              selectedPriceRange !== "ALL"
                ? "border-[1.5px] border-primary bg-emerald-50/50 text-primary font-semibold"
                : "border border-border bg-background text-foreground font-medium hover:border-foreground/40"
            }`}
          >
            <Banknote className="size-3.5 text-muted-foreground" />
            <span>{currentPriceObj.label}</span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>

          <span
            aria-hidden="true"
            className="h-5 w-px bg-border mx-1 hidden sm:inline-block"
          />

          {(
            [
              { code: "ALL", label: "Tất cả" },
              { code: "SPORT", label: "Thể thao" },
              { code: "CONCERT", label: "Hòa nhạc" },
              { code: "THEATER", label: "Sân khấu & Hài kịch" },
            ] as const
          ).map((genre) => {
            const isActive = selectedCategory === genre.code;
            return (
              <button
                key={genre.code}
                type="button"
                onClick={() => setSelectedCategory(genre.code)}
                data-testid={`filter-category-${genre.code.toLowerCase()}`}
                className={`h-9 px-3.5 rounded-[8px] text-[13px] transition-colors cursor-pointer ${
                  isActive
                    ? "border-[1.5px] border-primary bg-emerald-50/50 text-primary font-semibold"
                    : "border border-border bg-background text-foreground font-medium hover:border-foreground/40"
                }`}
              >
                {genre.label}
              </button>
            );
          })}

          <button
            type="button"
            onClick={handleResetFilters}
            data-testid="reset-filters-btn"
            className="h-9 px-3 rounded-[8px] text-[12.5px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted inline-flex items-center gap-1.5 transition-colors cursor-pointer ml-auto"
          >
            <RotateCcw className="size-3.5" />
            <span>Đặt lại</span>
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1
              data-testid="search-results-heading"
              className="text-[20px] sm:text-[22px] font-extrabold text-foreground"
            >
              {keyword.trim()
                ? `Kết quả tìm kiếm cho "${keyword.trim()}"`
                : "Khám phá & Tìm kiếm sự kiện"}
            </h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Hiển thị {items.length} / {totalFiltered} sự kiện phù hợp
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <div
            data-testid="empty-search-state"
            className="rounded-[16px] border border-border bg-muted p-12 text-center space-y-3"
          >
            <h2 className="text-[16px] font-bold text-foreground">
              Không tìm thấy sự kiện nào khớp với tiêu chí của bạn
            </h2>
            <p className="text-[13px] text-muted-foreground max-w-md mx-auto">
              Hãy thử xóa bộ lọc khoảng giá, chọn &ldquo;Toàn quốc&rdquo; hoặc
              tìm kiếm bằng từ khóa khác.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-4 py-2 rounded-[8px] bg-primary text-primary-foreground text-[13px] font-bold hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              Đặt lại toàn bộ bộ lọc
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {items.map((ev) => (
                <div
                  key={ev.id}
                  data-testid="search-result-card"
                  className="group relative flex flex-col"
                >
                  <div className="relative aspect-[5/4] w-full overflow-hidden rounded-[16px] bg-secondary">
                    <Link
                      href={`/events/${ev.id}`}
                      className="block h-full w-full"
                    >
                      <img
                        src={ev.image}
                        alt={ev.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </Link>
                  </div>

                  <Link
                    href={`/events/${ev.id}`}
                    className="pt-2.5 flex flex-col"
                  >
                    <h3 className="text-[14px] font-bold leading-[1.35] text-foreground truncate group-hover:text-primary transition-colors">
                      {ev.title}
                    </h3>
                    <p className="text-[12px] leading-[1.4] text-muted-foreground truncate mt-0.5">
                      {ev.dateRange} • {ev.venue}, {ev.city}
                    </p>
                    <p className="text-[14px] font-bold leading-[1.4] text-primary pt-1">
                      {ev.fromPrice}
                    </p>
                  </Link>
                </div>
              ))}
            </div>

            {hasMore && (
              <div className="pt-8 flex justify-center">
                <button
                  type="button"
                  onClick={handleLoadMoreCursor}
                  disabled={isLoadingMore}
                  data-testid="cursor-load-more-btn"
                  className="h-10 px-6 rounded-full border border-border bg-background hover:border-primary hover:bg-emerald-50/40 text-[13px] font-bold text-foreground inline-flex items-center gap-2 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="size-4 animate-spin text-primary" />
                      <span>Đang tải thêm sự kiện...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4 text-primary" />
                      <span>Xem thêm sự kiện</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
