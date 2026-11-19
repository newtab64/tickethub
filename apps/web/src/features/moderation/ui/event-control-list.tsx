"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EventControlQuerySchema } from "@tickethub/shared";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { PageNavigation } from "@/shared/ui/page-navigation";
import { formatDateTimeVi } from "@/shared/lib/format-vi";
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
    <section className="space-y-5 p-4 sm:p-6">
      <h1 className="text-xl font-semibold">Điều khiển sự kiện</h1>
      <div className="flex flex-wrap items-end gap-4">
        <label className="grid gap-1.5 text-sm">
          Trạng thái
          <select
            className="h-9 rounded-md border bg-background px-2"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái điều khiển</option>
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
              value={eventId}
              required
              aria-invalid={invalidId}
              onChange={(event) => {
                setEventId(event.target.value);
                setInvalidId(false);
              }}
            />
          </label>
          <Button>Mở sự kiện</Button>
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
          <ul className="divide-y rounded-lg border bg-background">
            {events.data.items.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/admin/events/${event.id}/control`}
                  prefetch={false}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 hover:bg-muted"
                >
                  <span className="font-medium">{event.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {event.status === "SUSPENDED"
                      ? "Đang đình chỉ"
                      : "Đã công bố"}{" "}
                    · Kết thúc {formatDateTimeVi(event.endTime)}
                  </span>
                </Link>
              </li>
            ))}
            {events.data.items.length === 0 && (
              <li className="p-4">Không có sự kiện trên trang này.</li>
            )}
          </ul>
          <PageNavigation
            page={page}
            hasMore={events.data.hasMore}
            onChange={setPage}
          />
        </>
      )}
    </section>
  );
}
