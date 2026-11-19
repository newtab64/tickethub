"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CalendarDays, House, Search } from "lucide-react";
import { EventControlQuerySchema } from "@tickethub/shared";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { PageNavigation } from "@/shared/ui/page-navigation";
import { formatDateTimeVi } from "@/shared/lib/format-vi";
import { AdminEventPoster } from "./admin-event-poster";
import { EventControlStatus } from "./event-control-status";
import { getEventControls } from "../api/event-control-api";

export function EventControlList() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [eventId, setEventId] = useState("");
  const [invalidId, setInvalidId] = useState(false);
  const router = useRouter();
  const events = useQuery({
    queryKey: ["adminEventControls", status, page],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ page: String(page) });
      if (status) params.set("status", status);
      return getEventControls(params, signal);
    },
    retry: false,
  });

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Điều khiển sự kiện
        </h1>
        <Button
          asChild
          variant="outline"
          className="min-h-10 rounded-full px-4"
        >
          <Link href="/">
            <House aria-hidden="true" />
            Trang chủ
          </Link>
        </Button>
      </header>
      <div className="flex flex-wrap items-end gap-4 rounded-xl border bg-background p-4">
        <label className="grid gap-1.5 text-sm">
          Trạng thái
          <select
            className="h-10 cursor-pointer rounded-lg border bg-background px-3 focus-visible:outline-2 focus-visible:outline-ring"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="PUBLISHED">Đã công bố</option>
            <option value="SUSPENDED">Đang đình chỉ</option>
          </select>
        </label>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const result = EventControlQuerySchema.safeParse({
              eventId: eventId.trim(),
            });
            if (!result.success) {
              setInvalidId(true);
              return;
            }
            router.push(`/admin/events/${result.data.eventId}/control`);
          }}
        >
          <label className="grid gap-1.5 text-sm">
            Mã sự kiện (UUID)
            <Input
              className="h-10 sm:w-80"
              placeholder="Dán mã sự kiện"
              value={eventId}
              required
              aria-invalid={invalidId}
              onChange={(event) => {
                setEventId(event.target.value);
                setInvalidId(false);
              }}
            />
          </label>
          <Button className="min-h-10 rounded-full px-4">
            <Search aria-hidden="true" />
            Mở sự kiện
          </Button>
        </form>
      </div>
      {invalidId && (
        <p role="alert" className="text-sm text-destructive">
          Mã sự kiện không hợp lệ.
        </p>
      )}
      {events.isPending && <p role="status">Đang tải sự kiện...</p>}
      {events.isError && (
        <p role="alert" className="text-destructive">
          {events.error.message}
        </p>
      )}
      {events.data && (
        <>
          {events.data.items.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {events.data.items.map((event) => (
                <li key={event.id} className="min-w-0">
                  <Link
                    href={`/admin/events/${event.id}/control`}
                    prefetch={false}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-background transition-[border-color,box-shadow] hover:border-primary/50 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  >
                    <div className="relative aspect-video overflow-hidden bg-muted">
                      <AdminEventPoster
                        event={event}
                        sizes="(min-width: 1280px) 340px, (min-width: 640px) 45vw, 95vw"
                      />
                      <div className="absolute top-3 left-3 rounded-full bg-background">
                        <EventControlStatus status={event.status} />
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <h2 className="break-words text-base font-bold leading-snug">
                        {event.title}
                      </h2>
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarDays
                          aria-hidden="true"
                          className="size-4 shrink-0"
                        />
                        Kết thúc {formatDateTimeVi(event.endTime)}
                      </p>
                      <span className="mt-auto flex items-center gap-2 pt-2 text-sm font-semibold text-primary">
                        Mở điều khiển{" "}
                        <ArrowRight
                          aria-hidden="true"
                          className="size-4 transition-transform motion-safe:group-hover:translate-x-1"
                        />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed bg-background p-8 text-center text-muted-foreground">
              Không có sự kiện phù hợp.
            </p>
          )}
          {(page > 1 || events.data.hasMore) && (
            <PageNavigation
              page={page}
              hasMore={events.data.hasMore}
              onChange={setPage}
            />
          )}
        </>
      )}
    </section>
  );
}
