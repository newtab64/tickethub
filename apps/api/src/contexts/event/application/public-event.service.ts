import { withSeatAvailability } from "../domain/event-rules";
import { eventErrors } from "../domain/event.errors";
import type {
  EventReadRepository,
  EventRepository,
} from "../domain/event.ports";

/** Truy van cong khai ve cac su kien da PUBLISHED. */
export class PublicEventService {
  constructor(
    private readonly events: EventRepository,
    private readonly reader: EventReadRepository,
  ) {}

  /** Loc theo tu khoa, thanh pho, the loai thuoc context Search; o day chi gioi han so luong. */
  async getPublicEvents(query: { limit?: number }) {
    const events = await this.events.listPublished(query.limit ?? 20);
    if (events.length === 0) return events;
    // Mot truy van ghe cho ca danh sach.
    const counts = await this.reader.countSeatsByStatus(
      events.map((e) => e.id),
    );
    return events.map((event) => withSeatAvailability(event, counts));
  }

  async getPublicEvent(identifier: string) {
    const event = await this.events.findPublished(identifier);
    if (!event) throw eventErrors.publicEventNotFound();
    return withSeatAvailability(
      event,
      await this.reader.countSeatsByStatus(event.id),
    );
  }
}
