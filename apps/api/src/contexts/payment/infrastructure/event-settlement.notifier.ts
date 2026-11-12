import type { SettlementImpact } from "../domain/payment.models";
import type { SettlementNotifier } from "../domain/payment.ports";

/** Cong sang context Event: xoa cache doc va phat SSE trang thai ghe (phu thuoc tuy chon). */
export class EventSettlementNotifier implements SettlementNotifier {
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

  async orderSettled(impact: SettlementImpact, paid: boolean): Promise<void> {
    await this.cache?.invalidate(impact.eventId);
    if (impact.seatIds.length > 0) {
      await this.seatStream?.publishSeatStatusChanged(impact.eventId, {
        seatIds: impact.seatIds,
        status: paid ? "SOLD" : "AVAILABLE",
        expiresAt: null,
      });
    }
  }
}
