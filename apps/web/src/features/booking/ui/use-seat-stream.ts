"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  DEFAULT_POLLING_INTERVAL_MS,
  buildSeatStreamUrl,
  fetchInventorySnapshot,
  parseSeatStreamPayload,
  type SeatLiveStatus,
  type SeatStatusChangedPayload,
} from "../api/seat-stream-client";

export type { SeatLiveStatus, SeatStatusChangedPayload };
export { DEFAULT_POLLING_INTERVAL_MS };

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
  reconnect: () => void;
}

/** Dong bo trang thai ghe thoi gian thuc qua SSE voi du phong lam moi moi 10 giay. */
export function useSeatStream({
  eventId,
  enabled = true,
  pollingIntervalMs = DEFAULT_POLLING_INTERVAL_MS,
  onSeatStatusChanged,
}: UseSeatStreamOptions): UseSeatStreamReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isPollingFallback, setIsPollingFallback] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [seatStatusMap, setSeatStatusMap] = useState<
    Record<string, SeatLiveStatus>
  >({});
  const [zoneDeltaMap, setZoneDeltaMap] = useState<Record<string, number>>({});
  const [reconnectTick, setReconnectTick] = useState(0);

  const callbackRef = useRef(onSeatStatusChanged);
  useEffect(() => {
    callbackRef.current = onSeatStatusChanged;
  }, [onSeatStatusChanged]);

  const applyPayload = useCallback((payload: SeatStatusChangedPayload) => {
    setSeatStatusMap((prev) => {
      const next = { ...prev };
      for (const id of payload.seatIds) {
        next[id] = payload.status;
      }
      return next;
    });

    if (payload.zoneId) {
      const delta =
        payload.status === "AVAILABLE"
          ? payload.seatIds.length
          : -payload.seatIds.length;
      setZoneDeltaMap((prev) => ({
        ...prev,
        [payload.zoneId!]: (prev[payload.zoneId!] ?? 0) + delta,
      }));
    }

    setLastUpdated(new Date());
    callbackRef.current?.(payload);
  }, []);

  const reconnect = useCallback(() => {
    setReconnectTick((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !eventId || typeof window === "undefined") return;

    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let bc: BroadcastChannel | null = null;
    const abortCtrl = new AbortController();

    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = setInterval(() => {
        setIsPollingFallback(true);
        void fetchInventorySnapshot(eventId, abortCtrl.signal).then((snap) => {
          if (snap) {
            setLastUpdated(new Date());
          }
        });
      }, pollingIntervalMs);
    };

    if ("BroadcastChannel" in window) {
      bc = new BroadcastChannel(`tickethub-seats-${eventId}`);
      bc.onmessage = (evt: MessageEvent) => {
        const parsed =
          typeof evt.data === "string"
            ? parseSeatStreamPayload(evt.data)
            : null;
        if (parsed) applyPayload(parsed);
      };
    }

    if ("EventSource" in window) {
      try {
        es = new EventSource(buildSeatStreamUrl(eventId), {
          withCredentials: true,
        });
        es.onopen = () => {
          setIsConnected(true);
          setIsPollingFallback(false);
          if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
          }
        };
        es.addEventListener("seat_status_changed", (evt: MessageEvent) => {
          const parsed = parseSeatStreamPayload(String(evt.data ?? ""));
          if (parsed) {
            applyPayload(parsed);
            bc?.postMessage(JSON.stringify(parsed));
          }
        });
        es.onerror = () => {
          setIsConnected(false);
          setIsPollingFallback(true);
          startPolling();
        };
      } catch {
        startPolling();
      }
    } else {
      startPolling();
    }

    return () => {
      abortCtrl.abort();
      es?.close();
      bc?.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [enabled, eventId, pollingIntervalMs, reconnectTick, applyPayload]);

  const heldCount = Object.values(seatStatusMap).filter(
    (s) => s === "HELD",
  ).length;

  return {
    isConnected,
    isPollingFallback,
    lastUpdated,
    seatStatusMap,
    zoneDeltaMap,
    heldCount,
    reconnect,
  };
}
