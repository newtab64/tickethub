"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { HeaderActions } from "@/features/identity";
import { SiteHeader } from "@/shared/ui/site-header";
import { fetchPublicEvent } from "../api/public-events";
import { categoryCode, type CategoryCode } from "../domain/event-discovery";
import { HeaderSearch } from "./header-search";

const NAV_CATEGORIES: { code: CategoryCode; label: string }[] = [
  { code: "CONCERT", label: "Hòa nhạc" },
  { code: "SPORT", label: "Thể thao" },
  { code: "THEATER", label: "Sân khấu" },
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
  const eventId = pathname.startsWith("/events/")
    ? pathname.split("/")[2]
    : undefined;
  // Thể loại của sự kiện đang xem; lỗi tải thì không đánh dấu mục nào.
  const [viewed, setViewed] = useState<{
    id: string;
    category: CategoryCode | null;
  } | null>(null);
  useEffect(() => {
    if (!eventId) return;
    let ignore = false;
    fetchPublicEvent(eventId)
      .then((event) => {
        if (ignore || !event) return;
        setViewed({ id: eventId, category: categoryCode(event.category) });
      })
      .catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, [eventId]);
  const activeCategory: string | null =
    pathname === "/"
      ? categoryParam
      : eventId && viewed?.id === eventId
        ? viewed.category
        : null;

  return (
    <SiteHeader
      // Nổi trên hero; hai bên viên thuốc vẫn bấm xuyên xuống trang.
      className="pointer-events-none sticky top-0 z-30 -mb-[68px] *:pointer-events-auto"
      center={
        <nav aria-label="Danh mục chính" className="ml-2 hidden gap-5 md:flex">
          {NAV_CATEGORIES.map((c) => (
            <Link
              key={c.code}
              href={`/?category=${c.code}#events-list`}
              aria-current={activeCategory === c.code ? "page" : undefined}
              className="flex min-h-11 items-center text-[15px] whitespace-nowrap decoration-2 underline-offset-8 hover:underline aria-[current=page]:font-semibold aria-[current=page]:underline"
            >
              {c.label}
            </Link>
          ))}
        </nav>
      }
      actions={
        <>
          <HeaderSearch />
          <HeaderActions />
        </>
      }
    />
  );
}
