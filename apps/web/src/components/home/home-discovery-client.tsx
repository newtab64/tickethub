/* eslint-disable @next/next/no-img-element */
// apps/web/src/components/home/home-discovery-client.tsx
"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Calendar,
  ChevronDown,
  Navigation,
  Banknote,
  Sparkles,
} from "lucide-react";
import {
  EVENTS,
  type CategoryCode,
  type EventItem,
} from "@/lib/events-catalog";
import { SearchAutocompleteBar } from "@/components/search/search-autocomplete-bar";
import { WaitlistEmailForm } from "@/components/events/waitlist-email-form";

const POPULAR_CATEGORIES = [
  {
    title: "Hòa nhạc",
    category: "CONCERT" as CategoryCode,
    image: "/images/events/cat-concerts.jpeg",
  },
  {
    title: "Bóng đá & V.League",
    category: "SPORT" as CategoryCode,
    image: "/images/events/cat-soccer.jpeg",
  },
  {
    title: "Nhạc kịch & Sân khấu",
    category: "THEATER" as CategoryCode,
    image: "/images/events/cat-theater.jpeg",
  },
  {
    title: "Bóng rổ VBA",
    category: "SPORT" as CategoryCode,
    image: "/images/events/cat-basketball.jpeg",
  },
];

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

function FavoriteHeartIcon({ isSaved }: { isSaved: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="transition-transform duration-150 hover:scale-110"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="m8.869 4.893.754.867a.5.5 0 0 0 .754 0l.754-.867c.46-.528 1.944-1.932 3.992-1.16A3.616 3.616 0 0 1 17.1 8.789c-.948 1.874-2.965 4.466-7.101 7.39-4.136-2.924-6.154-5.517-7.101-7.39a3.617 3.617 0 0 1 1.979-5.055c2.047-.772 3.53.632 3.99 1.16"
        className={isSaved ? "fill-primary" : "fill-black/40"}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4.348 2.33C1.383 3.447.202 6.778 1.56 9.465 2.714 11.745 5.14 14.737 10 18c4.86-3.264 7.286-6.255 8.44-8.535 1.358-2.687.177-6.018-2.788-7.135-1.947-.735-3.52-.11-4.53.584A6 6 0 0 0 10 3.908a6 6 0 0 0-1.123-.994c-1.01-.694-2.582-1.319-4.529-.584m4.52 2.563.755.867a.5.5 0 0 0 .754 0l.754-.867c.46-.528 1.944-1.932 3.992-1.16A3.616 3.616 0 0 1 17.1 8.789c-.948 1.874-2.965 4.466-7.101 7.39-4.136-2.924-6.154-5.517-7.101-7.39a3.617 3.617 0 0 1 1.979-5.055c2.048-.772 3.53.632 3.99 1.16"
        className="fill-white"
      />
    </svg>
  );
}

function EventGridCard({
  event,
  isSaved,
  onToggleSave,
}: {
  event: EventItem;
  isSaved: boolean;
  onToggleSave: (id: string) => void;
}) {
  return (
    <div className="group relative flex flex-col" data-testid="event-card">
      <div className="relative aspect-[5/4] w-full overflow-hidden rounded-[16px] bg-secondary">
        <Link href={`/events/${event.id}`} className="block h-full w-full">
          <img
            src={event.image}
            alt={event.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </Link>

        <button
          type="button"
          onClick={() => onToggleSave(event.id)}
          aria-label={isSaved ? "Bỏ lưu" : "Lưu vào yêu thích"}
          className="absolute top-3 right-3 p-1"
        >
          <FavoriteHeartIcon isSaved={isSaved} />
        </button>
      </div>

      <Link href={`/events/${event.id}`} className="pt-2 flex flex-col">
        <h3 className="text-[14px] font-bold leading-[1.35] text-foreground truncate group-hover:text-primary transition-colors">
          {event.title}
        </h3>
        <p className="text-[12px] leading-[1.4] text-muted-foreground truncate">
          {event.dateRange}
        </p>
        <p className="text-[14px] font-bold leading-[1.4] text-foreground pt-0.5">
          {event.fromPrice}
        </p>
      </Link>
    </div>
  );
}

interface HomeDiscoveryClientProps {
  initialKeyword?: string;
  initialCategory?: CategoryCode;
  initialCity?: "ALL" | "HCM" | "HN" | "DN";
  initialPriceRange?: string;
  initialFromDate?: string;
  initialToDate?: string;
}

export function HomeDiscoveryClient({
  initialCategory = "ALL",
  initialCity = "HCM",
  initialPriceRange = "ALL",
}: HomeDiscoveryClientProps) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryCode>(initialCategory);
  const [selectedCity, setSelectedCity] = useState<"ALL" | "HCM" | "HN" | "DN">(
    initialCity,
  );
  const [selectedDate, setSelectedDate] = useState<
    "ALL" | "WEEKEND" | "NOV" | "DEC"
  >("ALL");
  const [selectedPriceRange, setSelectedPriceRange] =
    useState<string>(initialPriceRange);
  const [trendingLimit, setTrendingLimit] = useState<number>(4);

  const [savedIds, setSavedIds] = useState<string[]>([]);

  const toggleSave = (id: string) => {
    setSavedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const cycleCity = () => {
    const order: Array<"HCM" | "HN" | "DN" | "ALL"> = [
      "HCM",
      "HN",
      "DN",
      "ALL",
    ];
    const next = order[(order.indexOf(selectedCity) + 1) % order.length]!;
    setSelectedCity(next);
  };

  const cycleDate = () => {
    const order: Array<"ALL" | "WEEKEND" | "NOV" | "DEC"> = [
      "ALL",
      "WEEKEND",
      "NOV",
      "DEC",
    ];
    const next = order[(order.indexOf(selectedDate) + 1) % order.length]!;
    setSelectedDate(next);
  };

  const cyclePriceRange = () => {
    const idx = PRICE_RANGES.findIndex((p) => p.id === selectedPriceRange);
    const next = PRICE_RANGES[(idx + 1) % PRICE_RANGES.length]!;
    setSelectedPriceRange(next.id);
  };

  const currentPriceObj = useMemo(
    () =>
      PRICE_RANGES.find((r) => r.id === selectedPriceRange) ?? PRICE_RANGES[0],
    [selectedPriceRange],
  );

  const cityButtonLabel =
    selectedCity === "HCM"
      ? "TP. Hồ Chí Minh"
      : selectedCity === "HN"
        ? "Hà Nội"
        : selectedCity === "DN"
          ? "Đà Nẵng"
          : "Toàn quốc";

  const dateButtonLabel =
    selectedDate === "ALL"
      ? "Tất cả ngày"
      : selectedDate === "WEEKEND"
        ? "Cuối tuần này"
        : selectedDate === "NOV"
          ? "Tháng 11"
          : "Tháng 12";

  const popularMarqueeEvents = useMemo(() => {
    return EVENTS.filter((e) => e.featuredOrder).sort(
      (a, b) => (a.featuredOrder ?? 99) - (b.featuredOrder ?? 99),
    );
  }, []);

  const filteredPool = useMemo(() => {
    return EVENTS.filter((ev) => {
      if (selectedCategory !== "ALL" && ev.category !== selectedCategory) {
        return false;
      }
      if (selectedDate !== "ALL" && ev.dateWindow !== selectedDate) {
        return false;
      }
      if (
        currentPriceObj.minPrice !== undefined &&
        ev.minPriceNumber < currentPriceObj.minPrice
      ) {
        return false;
      }
      if (
        currentPriceObj.maxPrice !== undefined &&
        ev.minPriceNumber > currentPriceObj.maxPrice
      ) {
        return false;
      }
      return true;
    });
  }, [selectedCategory, selectedDate, currentPriceObj]);

  const trendingPool = useMemo(() => {
    const prioritized = [
      ...filteredPool.filter((e) => e.trendingOrder),
      ...filteredPool.filter((e) => !e.trendingOrder),
    ];
    return prioritized;
  }, [filteredPool]);

  const trendingEvents = useMemo(() => {
    return trendingPool.slice(0, trendingLimit);
  }, [trendingPool, trendingLimit]);

  const hasMoreTrending = trendingLimit < trendingPool.length;

  const concertEvents = useMemo(() => {
    return filteredPool
      .filter(
        (e) =>
          (e.category === "CONCERT" || e.category === "FESTIVAL") &&
          !e.featuredOrder &&
          !e.trendingOrder,
      )
      .slice(0, 4);
  }, [filteredPool]);

  const sportEvents = useMemo(() => {
    return filteredPool.filter((e) => e.category === "SPORT").slice(0, 4);
  }, [filteredPool]);

  const theaterEvents = useMemo(() => {
    return filteredPool.filter((e) => e.category === "THEATER").slice(0, 4);
  }, [filteredPool]);

  return (
    <div className="bg-background">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="pt-2 pb-8">
          <SearchAutocompleteBar />
        </div>

        <section aria-labelledby="heading-popular" className="pb-6">
          <h2
            id="heading-popular"
            className="text-[19px] font-bold tracking-[-0.01em] text-foreground mb-4"
          >
            Sự kiện nổi bật
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {popularMarqueeEvents.map((ev) => {
              const isSaved = savedIds.includes(ev.id);
              return (
                <div
                  key={ev.id}
                  className="group relative aspect-[286/352] w-full overflow-hidden rounded-[16px] bg-foreground"
                >
                  <Link
                    href={`/events/${ev.id}`}
                    className="block h-full w-full"
                  >
                    <img
                      src={ev.portraitImage || ev.image}
                      alt={ev.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  </Link>

                  <button
                    type="button"
                    onClick={() => toggleSave(ev.id)}
                    aria-label={isSaved ? "Bỏ lưu" : "Lưu vào yêu thích"}
                    className="absolute top-3.5 right-3.5 p-1"
                  >
                    <FavoriteHeartIcon isSaved={isSaved} />
                  </button>

                  <Link
                    href={`/events/${ev.id}`}
                    className="absolute inset-x-0 bottom-0 p-4 text-white"
                  >
                    <h3 className="text-[17px] font-bold leading-snug text-white line-clamp-2">
                      {ev.title}
                    </h3>
                    <p className="text-[13px] text-white/90 mt-0.5">
                      {ev.dateRange}
                    </p>
                  </Link>
                </div>
              );
            })}
          </div>
        </section>

        <div className="py-3 mb-7 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setSelectedCity("HCM")}
            aria-label="Vị trí của tôi"
            className="size-9 rounded-[8px] bg-primary hover:bg-emerald-700 text-primary-foreground flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            <Navigation className="size-4 fill-current" />
          </button>

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

          <button
            type="button"
            onClick={cycleDate}
            className={`h-9 px-3 rounded-[8px] text-[13px] inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              selectedDate !== "ALL"
                ? "border-[1.5px] border-primary bg-emerald-50/50 text-primary font-semibold"
                : "border border-border bg-background text-foreground font-medium hover:border-foreground/40"
            }`}
          >
            <Calendar className="size-3.5 text-muted-foreground" />
            <span>{dateButtonLabel}</span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>

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
            className="h-5 w-px bg-border mx-1.5 hidden sm:inline-block"
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
        </div>

        <div className="space-y-12">
          {trendingEvents.length > 0 && (
            <section aria-labelledby="heading-trending">
              <div className="flex items-center justify-between mb-4">
                <h2
                  id="heading-trending"
                  className="text-[19px] font-bold tracking-[-0.01em] text-foreground"
                >
                  Sự kiện thịnh hành tại {cityButtonLabel}
                </h2>
                <Link
                  href="/search"
                  className="text-[13px] font-medium text-primary hover:underline"
                >
                  Tìm kiếm nâng cao
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {trendingEvents.map((ev) => (
                  <EventGridCard
                    key={ev.id}
                    event={ev}
                    isSaved={savedIds.includes(ev.id)}
                    onToggleSave={toggleSave}
                  />
                ))}
              </div>

              {hasMoreTrending && (
                <div className="pt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setTrendingLimit((prev) => prev + 4)}
                    data-testid="cursor-load-more-btn"
                    className="h-10 px-6 rounded-full border border-border bg-background hover:border-primary hover:bg-emerald-50/40 text-[13px] font-bold text-foreground inline-flex items-center gap-2 transition-all shadow-2xs cursor-pointer"
                  >
                    <Sparkles className="size-4 text-primary" />
                    <span>Xem thêm sự kiện</span>
                  </button>
                </div>
              )}
            </section>
          )}

          <section aria-labelledby="heading-categories">
            <h2
              id="heading-categories"
              className="text-[19px] font-bold tracking-[-0.01em] text-foreground mb-4"
            >
              Danh mục phổ biến
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {POPULAR_CATEGORIES.map((cat) => (
                <button
                  key={cat.title}
                  type="button"
                  onClick={() =>
                    router.push(`/search?category=${cat.category}`)
                  }
                  className="group relative aspect-[16/10] w-full overflow-hidden rounded-[14px] bg-foreground text-left cursor-pointer"
                >
                  <img
                    src={cat.image}
                    alt={cat.title}
                    loading="lazy"
                    className="h-full w-full object-cover brightness-75 transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <span className="absolute bottom-3 left-3.5 text-[15px] font-bold text-white">
                    {cat.title}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {concertEvents.length > 0 && (
            <section aria-labelledby="heading-concerts">
              <div className="flex items-center justify-between mb-4">
                <h2
                  id="heading-concerts"
                  className="text-[19px] font-bold tracking-[-0.01em] text-foreground"
                >
                  Hòa nhạc
                </h2>
                <Link
                  href="/search?category=CONCERT"
                  className="text-[13px] font-medium text-primary hover:underline"
                >
                  Khám phá Hòa nhạc
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {concertEvents.map((ev) => (
                  <EventGridCard
                    key={ev.id}
                    event={ev}
                    isSaved={savedIds.includes(ev.id)}
                    onToggleSave={toggleSave}
                  />
                ))}
              </div>
            </section>
          )}

          {sportEvents.length > 0 && (
            <section aria-labelledby="heading-sports">
              <div className="flex items-center justify-between mb-4">
                <h2
                  id="heading-sports"
                  className="text-[19px] font-bold tracking-[-0.01em] text-foreground"
                >
                  Thể thao
                </h2>
                <Link
                  href="/search?category=SPORT"
                  className="text-[13px] font-medium text-primary hover:underline"
                >
                  Khám phá Thể thao
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {sportEvents.map((ev) => (
                  <EventGridCard
                    key={ev.id}
                    event={ev}
                    isSaved={savedIds.includes(ev.id)}
                    onToggleSave={toggleSave}
                  />
                ))}
              </div>
            </section>
          )}

          {theaterEvents.length > 0 && (
            <section aria-labelledby="heading-theater">
              <div className="flex items-center justify-between mb-4">
                <h2
                  id="heading-theater"
                  className="text-[19px] font-bold tracking-[-0.01em] text-foreground"
                >
                  Sân khấu &amp; Hài kịch
                </h2>
                <Link
                  href="/search?category=THEATER"
                  className="text-[13px] font-medium text-primary hover:underline"
                >
                  Khám phá Sân khấu
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {theaterEvents.map((ev) => (
                  <EventGridCard
                    key={ev.id}
                    event={ev}
                    isSaved={savedIds.includes(ev.id)}
                    onToggleSave={toggleSave}
                  />
                ))}
              </div>
            </section>
          )}

          <div className="rounded-[12px] border border-border bg-background px-6 py-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center -space-x-3 shrink-0">
                <img
                  src="/images/events/vn/ha-anh-tuan.jpg"
                  alt=""
                  className="size-11 rounded-full object-cover border-2 border-background"
                />
                <img
                  src="/images/events/vn/my-tam.jpg"
                  alt=""
                  className="size-11 rounded-full object-cover border-2 border-background"
                />
                <img
                  src="/images/events/vn/soobin.jpg"
                  alt=""
                  className="size-11 rounded-full object-cover border-2 border-background"
                />
              </div>
              <div>
                <p className="text-[15px] sm:text-[16px] font-bold text-foreground">
                  Nhận thông báo ngay khi nghệ sĩ yêu thích của bạn mở bán vé
                </p>
                <p className="text-[12.5px] text-muted-foreground">
                  Cập nhật sớm nhất lịch mở bán và vé bổ sung qua email của bạn.
                </p>
              </div>
            </div>

            <WaitlistEmailForm variant="inline" />
          </div>
        </div>
      </div>
    </div>
  );
}
