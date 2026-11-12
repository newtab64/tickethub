import type { RefundNotifier } from "../domain/refund.ports";

/**
 * Adapter sang context Events: invalidate cache doc va phat SSE trang thai ghe.
 * Cac phu thuoc la tuy chon de giu hanh vi cu khi chay ngoai Nest.
 */
export class EventSideEffectsNotifier implements RefundNotifier {
  constructor(
    private readonly cache?: { invalidate(eventId: string): Promise<void> },
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

  async ticketsReleased(input: {
    eventId: string;
    seatIdsByEvent: ReadonlyMap<string, string[]>;
  }): Promise<void> {
    if (this.cache) await this.cache.invalidate(input.eventId);
    if (this.seatStream) {
      for (const [eventId, seatIds] of input.seatIdsByEvent) {
        await this.seatStream.publishSeatStatusChanged(eventId, {
          seatIds,
          status: "AVAILABLE",
          expiresAt: null,
        });
      }
    }
  }
}
