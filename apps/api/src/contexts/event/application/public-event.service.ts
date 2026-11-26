import { eventErrors } from "../domain/event.errors";
import type { EventRepository } from "../domain/event.ports";

/** Truy van cong khai ve cac su kien da PUBLISHED. */
export class PublicEventService {
  constructor(private readonly events: EventRepository) {}

  /** Loc theo tu khoa, thanh pho, the loai thuoc context Search; o day chi gioi han so luong. */
  getPublicEvents(query: { limit?: number }) {
    return this.events.listPublished(query.limit ?? 20);
  }

  async getPublicEventBySlug(slug: string) {
    const event = await this.events.findPublishedBySlug(slug);
    if (!event) throw eventErrors.publicEventNotFound();
    return event;
  }
}
