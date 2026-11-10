"use client";

import { useEffect, useState, useRef, useCallback } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export type SeatLiveStatus = "AVAILABLE" | "HELD" | "SOLD" | "BLOCKED";

export interface SeatStatusChangedPayload {
  seatIds: string[];
  status: SeatLiveStatus;
  zoneId?: string;
  expiresAt?: string | null;
}

export interface UseSeatStreamOptions {
  eventId: string;
  enabled?: boolean;
  pollingIntervalMs?: number;
  onSeatStatusChanged?: (payload: SeatStatusChangedPayload) => void;
}

export interface UseSeatStreamReturn {
  isConnected: boolean;
  isPollingFallback: boolean;
  lastUpdated: Date | null;
  seatStatusMap: Record<string, SeatLiveStatus>;
  zoneDeltaMap: Record<string, number>;
  heldCount: number;
  soldCount: number;
  error: string | null;
  refreshNow: () => Promise<void>;
  broadcastSeatChange: (payload: SeatStatusChangedPayload) => void;
}

export const DEFAULT_POLLING_INTERVAL_MS = 10000;

export function useSeatStream({
  eventId,
  enabled = true,
  pollingIntervalMs = DEFAULT_POLLING_INTERVAL_MS,
  onSeatStatusChanged,
}: UseSeatStreamOptions): UseSeatStreamReturn {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isPollingFallback, setIsPollingFallback] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [seatStatusMap, setSeatStatusMap] = useState<
    Record<string, SeatLiveStatus>
  >({});
  const [zoneDeltaMap, setZoneDeltaMap] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const callbackRef = useRef(onSeatStatusChanged);

  useEffect(() => {
    callbackRef.current = onSeatStatusChanged;
  }, [onSeatStatusChanged]);

  const applySeatStatusChange = useCallback(
    (payload: SeatStatusChangedPayload) => {
      if (!payload?.seatIds || !Array.isArray(payload.seatIds)) return;

      setSeatStatusMap((prev) => {
        const next = { ...prev };
        for (const id of payload.seatIds) {
          next[id] = payload.status;
        }
        return next;
      });

      if (payload.zoneId) {
        const zoneKey = payload.zoneId;
        const delta =
          payload.status === "AVAILABLE"
            ? payload.seatIds.length
            : -payload.seatIds.length;
        setZoneDeltaMap((prev) => ({
          ...prev,
          [zoneKey]: (prev[zoneKey] ?? 0) + delta,
        }));
      }

      setLastUpdated(new Date());

      if (callbackRef.current) {
        callbackRef.current(payload);
      }
    },
    [],
  );

  const broadcastSeatChange = useCallback(
    (payload: SeatStatusChangedPayload) => {
      applySeatStatusChange(payload);

      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({
            type: "SEAT_STATUS_CHANGED",
            payload,
            timestamp: Date.now(),
          });
        } catch {
          // BroadcastChannel error ignored
        }
      }
    },
    [applySeatStatusChange],
  );

  const pollInventory = useCallback(async () => {
    if (!eventId) return;

    try {
      const res = await fetch(`${API_BASE_URL}/events/${eventId}/inventory`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!res.ok) return;

      const json = await res.json();
      if (json?.data?.seats && Array.isArray(json.data.seats)) {
        const newMap: Record<string, SeatLiveStatus> = {};
        for (const s of json.data.seats) {
          if (s.id && s.status) {
            newMap[s.id] = s.status;
          }
        }
        setSeatStatusMap((prev) => ({ ...prev, ...newMap }));
        setLastUpdated(new Date());
      }
    } catch {
      // Silent retry on next polling cycle
    }
  }, [eventId]);

  const startFallbackPolling = useCallback(() => {
    setIsPollingFallback(true);
    setIsConnected(false);

    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
    }

    void pollInventory();

    pollingTimerRef.current = setInterval(() => {
      void pollInventory();
    }, pollingIntervalMs);
  }, [pollInventory, pollingIntervalMs]);

  const stopFallbackPolling = useCallback(() => {
    setIsPollingFallback(false);
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !eventId || !enabled) return;

    try {
      const channel = new BroadcastChannel(`tickethub_seats_${eventId}`);
      broadcastChannelRef.current = channel;

      channel.onmessage = (event) => {
        if (event.data?.type === "SEAT_STATUS_CHANGED" && event.data?.payload) {
          applySeatStatusChange(event.data.payload);
        }
      };

      return () => {
        channel.close();
        broadcastChannelRef.current = null;
      };
    } catch {
      // BroadcastChannel not supported
    }
  }, [eventId, enabled, applySeatStatusChange]);

  useEffect(() => {
    if (typeof window === "undefined" || !eventId || !enabled) return;

    let isSubscribed = true;
    const streamUrl = `${API_BASE_URL}/events/${eventId}/seats/stream`;

    try {
      const es = new EventSource(streamUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (!isSubscribed) return;
        setIsConnected(true);
        setError(null);
        stopFallbackPolling();
      };

      es.addEventListener("seat_status_changed", (event: MessageEvent) => {
        if (!isSubscribed) return;
        try {
          const payload = JSON.parse(event.data) as SeatStatusChangedPayload;
          applySeatStatusChange(payload);
        } catch {
          // Ignore malformed JSON
        }
      });

      es.onmessage = (event: MessageEvent) => {
        if (!isSubscribed) return;
        try {
          const parsed = JSON.parse(event.data);
          if (parsed?.seatIds && parsed?.status) {
            applySeatStatusChange(parsed);
          }
        } catch {
          // Ignore heartbeat ping
        }
      };

      es.onerror = () => {
        if (!isSubscribed) return;
        setError("Mat ket noi SSE, chuyen sang dong bo 10 giay.");
        startFallbackPolling();
      };
    } catch (err: unknown) {
      if (!isSubscribed) return;
      const msg =
        err instanceof Error ? err.message : "Khong khoi tao duoc SSE";
      setTimeout(() => {
        if (!isSubscribed) return;
        setError(msg);
        startFallbackPolling();
      }, 0);
    }

    return () => {
      isSubscribed = false;
      stopFallbackPolling();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [
    eventId,
    enabled,
    applySeatStatusChange,
    startFallbackPolling,
    stopFallbackPolling,
  ]);

  const values = Object.values(seatStatusMap);
  const heldCount = values.filter((s) => s === "HELD").length;
  const soldCount = values.filter((s) => s === "SOLD").length;

  return {
    isConnected,
    isPollingFallback,
    lastUpdated,
    seatStatusMap,
    zoneDeltaMap,
    heldCount,
    soldCount,
    error,
    refreshNow: pollInventory,
    broadcastSeatChange,
  };
}
