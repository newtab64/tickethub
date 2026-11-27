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
  getPublicEvents(query: { limit?: number }) {
    return this.events.listPublished(query.limit ?? 20);
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
