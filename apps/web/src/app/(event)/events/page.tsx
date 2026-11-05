"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listPublicEvents } from "@/lib/api/events";
import { dateTime, money } from "@/lib/checkout";
import { FlowShell, FlowError } from "@/components/checkout/flow-shell";
import { Button } from "@/components/ui/button";
export default function EventsPage() {
  const query = useQuery({
    queryKey: ["public-events"],
    queryFn: listPublicEvents,
    retry: false,
  });
  return (
    <FlowShell title="Sự kiện đang mở bán">
      {query.isPending && <p role="status">Đang tải sự kiện...</p>}
      {query.error && (
        <>
          <FlowError error={query.error} />
          <Button onClick={() => query.refetch()}>Thử lại</Button>
        </>
      )}
      {query.data?.length === 0 && (
        <p>
          Chưa có sự kiện được công bố. Cần chạy seed hoặc tạo và duyệt sự kiện
          trước khi đặt vé.
        </p>
      )}
      <ul className="grid gap-5 sm:grid-cols-2">
        {query.data?.map((event) => (
          <li
            key={event.id}
            className="space-y-3 rounded-xl border border-border bg-background p-6"
          >
            <h2 className="text-xl font-bold">{event.title}</h2>
            <p>{dateTime(event.startTime)}</p>
            <p>
              {event.venueName} · {event.city}
            </p>
            {event.ticketTypes.length > 0 && (
              <p>
                Từ {money(Math.min(...event.ticketTypes.map((t) => t.price)))}
              </p>
            )}
            <Link
              className="font-semibold text-primary underline"
              href={`/events/${event.slug}`}
            >
              Xem sự kiện
            </Link>
          </li>
        ))}
      </ul>
    </FlowShell>
  );
}
