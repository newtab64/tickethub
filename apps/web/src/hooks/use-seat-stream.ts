"use client";

import { useEffect, useState, useRef, useCallback } from "react";

export type SeatLiveStatus = "AVAILABLE" | "HELD" | "SOLD";

export interface SeatStatusChangedPayload {
  seatIds: string[];
  status: SeatLiveStatus;
  zoneId?: string;
  expiresAt?: string;
}

export interface UseSeatStreamOptions {
  eventId: string;
  enabled?: boolean;
  pollingIntervalMs?: number; // Default 10000ms (10 seconds)
  onSeatStatusChanged?: (payload: SeatStatusChangedPayload) => void;
}

export interface UseSeatStreamReturn {
  isConnected: boolean;
  isPollingFallback: boolean;
  lastUpdated: Date | null;
  seatStatusMap: Record<string, SeatLiveStatus>;
  heldCount: number;
  soldCount: number;
  error: string | null;
  refreshNow: () => Promise<void>;
  broadcastSeatChange: (payload: SeatStatusChangedPayload) => void;
}

const DEFAULT_POLLING_INTERVAL = 10000; // 10s theo tieu chuan UC04

export function useSeatStream({
  eventId,
  enabled = true,
  pollingIntervalMs = DEFAULT_POLLING_INTERVAL,
  onSeatStatusChanged,
}: UseSeatStreamOptions): UseSeatStreamReturn {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isPollingFallback, setIsPollingFallback] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [seatStatusMap, setSeatStatusMap] = useState<
    Record<string, SeatLiveStatus>
  >({});
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const callbackRef = useRef(onSeatStatusChanged);

  useEffect(() => {
    callbackRef.current = onSeatStatusChanged;
  }, [onSeatStatusChanged]);

  // Apply single status change payload
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

      setLastUpdated(new Date());

      if (callbackRef.current) {
        callbackRef.current(payload);
      }
    },
    [],
  );

  // Cross-browser/tab broadcast helper
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
          // Ignore broadcast errors
        }
      }
    },
    [applySeatStatusChange],
  );

  // Polling function when SSE is disconnected
  const pollInventory = useCallback(async () => {
    if (!eventId) return;

    try {
      const res = await fetch(`/api/v1/events/${eventId}/inventory`, {
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
      // Polling network fail, silent retry next interval
    }
  }, [eventId]);

  // Start 10s fallback polling
  const startFallbackPolling = useCallback(() => {
    setIsPollingFallback(true);
    setIsConnected(false);

    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
    }

    // Immediate first poll
    pollInventory();

    pollingTimerRef.current = setInterval(() => {
      pollInventory();
    }, pollingIntervalMs);
  }, [pollInventory, pollingIntervalMs]);

  // Stop polling
  const stopFallbackPolling = useCallback(() => {
    setIsPollingFallback(false);
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  // Set up BroadcastChannel for instant cross-tab real-time sync
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
      // BroadcastChannel not supported in environment
    }
  }, [eventId, enabled, applySeatStatusChange]);

  // Establish SSE connection
  useEffect(() => {
    if (typeof window === "undefined" || !eventId || !enabled) return;

    let isSubscribed = true;
    const streamUrl = `/api/v1/events/${eventId}/seats/stream`;

    try {
      const es = new EventSource(streamUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (!isSubscribed) return;
        setIsConnected(true);
        setError(null);
        stopFallbackPolling();
      };

      // Contract event: seat_status_changed
      es.addEventListener("seat_status_changed", (event: MessageEvent) => {
        if (!isSubscribed) return;
        try {
          const payload = JSON.parse(event.data) as SeatStatusChangedPayload;
          applySeatStatusChange(payload);
        } catch {
          // parse error
        }
      });

      // Contract heartbeat / general message
      es.onmessage = (event: MessageEvent) => {
        if (!isSubscribed) return;
        try {
          const parsed = JSON.parse(event.data);
          if (parsed?.seatIds && parsed?.status) {
            applySeatStatusChange(parsed);
          }
        } catch {
          // ignore heartbeat ping
        }
      };

      es.onerror = () => {
        if (!isSubscribed) return;
        setError("SSE connection lost. Falling back to 10s polling.");
        startFallbackPolling();
      };
    } catch (err: unknown) {
      if (!isSubscribed) return;
      const msg = err instanceof Error ? err.message : "SSE init failed";
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

  // Derive held & sold counts
  const values = Object.values(seatStatusMap);
  const heldCount = values.filter((s) => s === "HELD").length;
  const soldCount = values.filter((s) => s === "SOLD").length;

  return {
    isConnected,
    isPollingFallback,
    lastUpdated,
    seatStatusMap,
    heldCount,
    soldCount,
    error,
    refreshNow: pollInventory,
    broadcastSeatChange,
  };
}
