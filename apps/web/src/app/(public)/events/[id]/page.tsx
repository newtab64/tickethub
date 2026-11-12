import type { Metadata } from "next";
import { EventDetailPage, getEventById } from "@/features/event";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const event = getEventById(id);
  if (!event) return { title: "Không tìm thấy sự kiện | tickethub" };
  return {
    title: `${event.title} | tickethub`,
    description: event.description,
    openGraph: {
      title: event.title,
      description: event.description,
      images: [event.image],
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <EventDetailPage id={id} />;
}
