import { PublicEventSchema, PublicEventListSchema } from "@tickethub/shared";
import { apiClient } from "./client";

export async function listPublicEvents() {
  return PublicEventListSchema.parse(
    await apiClient<unknown>("/events?limit=50"),
  ).items;
}
export async function getPublicEvent(identifier: string) {
  let slug = identifier;
  if (
    /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
      identifier,
    )
  ) {
    const event = (await listPublicEvents()).find(
      (item) => item.id === identifier,
    );
    if (!event)
      throw new Error("Sự kiện không có trong danh sách đang mở bán.");
    slug = event.slug;
  }
  return PublicEventSchema.parse(
    await apiClient<unknown>(`/events/${encodeURIComponent(slug)}`),
  );
}
