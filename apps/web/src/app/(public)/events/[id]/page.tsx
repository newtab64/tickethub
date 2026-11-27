import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventDetailPage, fetchPublicEvent } from "@/features/event";

type PageProps = { params: Promise<{ id: string }> };

// Metadata va trang dung chung mot lan doc.
const loadEvent = cache(fetchPublicEvent);

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const event = await loadEvent((await params).id);
  if (!event) return { title: "Không tìm thấy sự kiện | tickethub" };
  return {
    title: `${event.title} | tickethub`,
    description: event.description,
    openGraph: {
      title: event.title,
      description: event.description,
      images: [event.bannerUrl],
    },
  };
}

export default async function Page({ params }: PageProps) {
  const event = await loadEvent((await params).id);
  if (!event) notFound();
  return <EventDetailPage event={event} />;
}
