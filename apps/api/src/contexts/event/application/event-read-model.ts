import { buildInventoryItems, groupSeatMap } from "../domain/event-rules";
import { eventErrors } from "../domain/event.errors";
import type { EventInventory, SeatMap } from "../domain/event.models";
import type { EventReadRepository, ReadCache } from "../domain/event.ports";

const TTL_SECONDS = 60;

const seatMapKey = (eventId: string) => `w03:seatmap:v1:${eventId}`;
const inventoryKey = (eventId: string) => `w03:inventory:v1:${eventId}`;

/**
 * Mo hinh doc cua Event: so do ghe va ton kho theo cache-aside (60 giay).
 * Cac context khac goi `invalidate` sau khi thay doi ve hoac ghe.
 */
export class EventReadModel {
  constructor(
    private readonly cache: ReadCache,
    private readonly reader: EventReadRepository,
  ) {}

  private async cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const hit = await this.cache.get<T>(key);
    if (hit !== null) return hit;
    const data = await loader();
    await this.cache.set(key, data, TTL_SECONDS);
    return data;
  }

  getSeatMap(eventId: string): Promise<SeatMap> {
    return this.cached(seatMapKey(eventId), () => this.loadSeatMap(eventId));
  }

  getInventory(eventId: string): Promise<EventInventory> {
    return this.cached(inventoryKey(eventId), () =>
      this.loadInventory(eventId),
    );
  }

  async invalidate(eventId: string): Promise<void> {
    await this.cache.del(seatMapKey(eventId), inventoryKey(eventId));
  }

  /** Doc truc tiep tu nguon chinh, khong qua cache. */
  async loadSeatMap(eventId: string): Promise<SeatMap> {
    const event = await this.reader.findWithTicketTypes(eventId);
    if (!event) throw eventErrors.eventNotFound();
    return groupSeatMap(eventId, await this.reader.listSeatsOrdered(eventId));
  }

  private async loadInventory(eventId: string): Promise<EventInventory> {
    if (!(await this.reader.publishedEventExists(eventId))) {
      throw eventErrors.notOpenForSale();
    }
    const types = await this.reader.listInventoryTicketTypes(eventId);
    const counts = await this.reader.countSeatsByStatus(eventId);
    return {
      eventId,
      items: buildInventoryItems(types, counts),
      refreshedAt: new Date().toISOString(),
    };
  }
}
