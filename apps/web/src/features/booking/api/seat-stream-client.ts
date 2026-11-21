export type SeatLiveStatus = "AVAILABLE" | "HELD" | "SOLD" | "BLOCKED";

export interface SeatStatusChangedPayload {
  seatIds: string[];
  status: SeatLiveStatus;
  zoneId?: string;
  expiresAt?: string | null;
}

export const DEFAULT_POLLING_INTERVAL_MS = 10_000;

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export function buildSeatStreamUrl(eventId: string): string {
  return `${API_BASE_URL}/events/${encodeURIComponent(eventId)}/seats/stream`;
}

export function buildSeatInventoryUrl(eventId: string): string {
  return `${API_BASE_URL}/events/${encodeURIComponent(eventId)}/inventory`;
}

export function parseSeatStreamPayload(
  raw: string,
): SeatStatusChangedPayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<SeatStatusChangedPayload>;
    if (!Array.isArray(parsed.seatIds) || typeof parsed.status !== "string") {
      return null;
    }
    const validStatuses: SeatLiveStatus[] = [
      "AVAILABLE",
      "HELD",
      "SOLD",
      "BLOCKED",
    ];
    if (!validStatuses.includes(parsed.status as SeatLiveStatus)) {
      return null;
    }
    return {
      seatIds: parsed.seatIds.filter(
        (id): id is string => typeof id === "string",
      ),
      status: parsed.status as SeatLiveStatus,
      zoneId: typeof parsed.zoneId === "string" ? parsed.zoneId : undefined,
      expiresAt:
        typeof parsed.expiresAt === "string" || parsed.expiresAt === null
          ? parsed.expiresAt
          : undefined,
    };
  } catch {
    return null;
  }
}

export async function fetchInventorySnapshot(
  eventId: string,
  signal?: AbortSignal,
): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(buildSeatInventoryUrl(eventId), {
      method: "GET",
      credentials: "include",
      signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { zones?: Array<{ zoneId?: string; available?: number }> };
    };
    const zones = json.data?.zones;
    if (!Array.isArray(zones)) return null;
    const map: Record<string, number> = {};
    for (const z of zones) {
      if (typeof z.zoneId === "string" && typeof z.available === "number") {
        map[z.zoneId] = z.available;
      }
    }
    return map;
  } catch {
    return null;
  }
}
