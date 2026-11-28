"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { formatEventDateTime } from "@/features/event";
import { HeaderActions } from "@/features/identity";
import { SiteHeader } from "@/shared/ui/site-header";
import type { BookingScreen } from "./use-booking-screen";

/** Header đặt vé: quay lại trang sự kiện, tên sự kiện ở giữa. */
export function BookingHeader({ vm }: { vm: BookingScreen }) {
  const { event } = vm;

  return (
    <SiteHeader
      className="z-30 shrink-0 pb-3"
      leading={
        <Link
          href={`/events/${event.slug}`}
          aria-label="Quay lại"
          className="-ml-3 flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-fill sm:-ml-4"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </Link>
      }
      // Màn hẹp dành chỗ cho tên sự kiện.
      logoClassName="max-md:hidden"
      center={
        <div className="min-w-0 text-center leading-tight">
          <h1 className="truncate text-[15px] font-semibold">{event.title}</h1>
          <p className="truncate text-[13px] text-muted-foreground">
            {formatEventDateTime(event.startTime)}
            <span className="max-sm:hidden">, {event.city}</span>
          </p>
        </div>
      }
      actions={<HeaderActions ticketsClassName="max-sm:hidden" />}
    />
  );
}
