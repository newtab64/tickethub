// apps/web/src/app/(event)/events/[id]/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { EVENTS, getEventById } from "@/lib/events-catalog";
import { EventSplitView } from "@/components/events/event-detail-client"; // Import component giao diện

type EventParamsPromise = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: EventParamsPromise;
}): Promise<Metadata> {
  const resolved = await params;
  const event = getEventById(resolved.id) ?? EVENTS[0]!;

  return {
    title: `${event.title} | Vé sự kiện chính thức TicketHub`,
    description: `${event.description} Thời gian: ${event.fullDateTime} tại ${event.venue}, ${event.city}.`,
    openGraph: {
      title: `${event.title} - Vé chính thức trên TicketHub`,
      description: `${event.fullDateTime} • ${event.venue}, ${event.city}. Giá từ ${event.fromPrice}.`,
      images: [{ url: event.image, alt: event.title }],
      type: "website",
    },
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: EventParamsPromise;
}) {
  const resolved = await params;
  const event = getEventById(resolved.id) ?? EVENTS[0]!;

  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center text-[13px] text-muted-foreground">
          Đang tải sơ đồ sự kiện...
        </div>
      }
    >
      <EventSplitView key={event.id} event={event} />
    </Suspense>
  );
}
