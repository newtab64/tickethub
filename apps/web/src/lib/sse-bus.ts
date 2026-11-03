import { EventEmitter } from "node:events";

export interface SseSeatEvent {
  seatIds: string[];
  status: "HELD" | "SOLD" | "AVAILABLE";
  zoneId?: string;
  expiresAt?: string;
}

// Global EventEmitter for server-side SSE broadcasting across all client connections
declare global {
  var __tickethub_sse_bus__: EventEmitter | undefined;
}

const sseBus = globalThis.__tickethub_sse_bus__ ?? new EventEmitter();
sseBus.setMaxListeners(200);

if (process.env.NODE_ENV !== "production") {
  globalThis.__tickethub_sse_bus__ = sseBus;
}

export function broadcastSeatStatus(eventId: string, event: SseSeatEvent) {
  sseBus.emit(`event:${eventId}:seat_status_changed`, event);
}

export function subscribeSeatStatus(
  eventId: string,
  listener: (event: SseSeatEvent) => void,
) {
  const channel = `event:${eventId}:seat_status_changed`;
  sseBus.on(channel, listener);
  return () => {
    sseBus.off(channel, listener);
  };
}

export { sseBus };
