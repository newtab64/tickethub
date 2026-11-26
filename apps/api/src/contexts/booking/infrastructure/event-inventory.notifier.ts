import type { InventoryNotifier } from "../domain/booking.ports";

/** Cong sang context Event: xoa cache doc va phat SSE (cac phu thuoc deu tuy chon). */
export class EventInventoryNotifier implements InventoryNotifier {
  constructor(
    private readonly cache: { invalidate(eventId: string): Promise<void> },
    private readonly seatStream?: {
      publishSeatStatusChanged(
        eventId: string,
        payload: {
          seatIds: string[];
          status: "AVAILABLE" | "HELD" | "SOLD" | "BLOCKED";
          expiresAt: string | null;
        },
      ): Promise<void>;
    },
  ) {}

  invalidateEvent(eventId: string): Promise<void> {
    return this.cache.invalidate(eventId);
  }

  async seatsChanged(
    eventId: string,
    seatIds: string[],
    status: "HELD" | "AVAILABLE",
    expiresAt: string | null,
  ): Promise<void> {
    await this.seatStream?.publishSeatStatusChanged(eventId, {
      seatIds,
      status,
      expiresAt,
    });
  }
}
