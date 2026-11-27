"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GetTicketQrResponseSchema } from "@tickethub/shared";
import { apiClient, ApiError } from "@/shared/api/client";
import {
  isQrRejection,
  qrSecondsLeft,
  qrView,
  type QrView,
} from "../domain/ticket-qr";

// Loi khong co ma HTTP (mat mang, du lieu sai) duoc coi la loi tam thoi.
const statusOf = (error: unknown) =>
  error === null ? null : error instanceof ApiError ? error.status : 0;

/** Vong doi ma QR cua mot ve: xin ma, dem lui, doi ma khi het han. */
export function useTicketQr(ticketId: string | null) {
  const query = useQuery({
    queryKey: ["ticket-qr", ticketId],
    queryFn: async () => {
      const data = GetTicketQrResponseSchema.parse(
        await apiClient<unknown>(
          `/tickets/${encodeURIComponent(ticketId!)}/qr`,
        ),
      );
      if (data.ticketId !== ticketId) throw new Error("Mã QR không khớp vé.");
      return { ...data, receivedAt: Date.now() };
    },
    enabled: ticketId !== null,
    // Ma khong duoc nam lai trong cache sau khi dong hop thoai.
    gcTime: 0,
    retry: false,
    // Hen lan xin tiep theo dung luc ma het han; loi thi cho nguoi dung thu lai.
    // TanStack khong goi khi tab an.
    refetchInterval: ({ state }) =>
      state.error || !state.data
        ? false
        : Math.max(
            500,
            state.data.receivedAt +
              state.data.remainingSeconds * 1000 -
              Date.now(),
          ),
    refetchOnWindowFocus: ({ state }) =>
      isQrRejection(statusOf(state.error)) ? false : "always",
  });

  // Dong ho hien thi. Khi tab an thi khong ve ma, de luc quay lai khong lo ma cu.
  const [clock, setClock] = useState(() => ({
    now: Date.now(),
    hidden: false,
  }));
  useEffect(() => {
    if (ticketId === null) return;
    const tick = () =>
      setClock({
        now: Date.now(),
        hidden: document.visibilityState === "hidden",
      });
    const timer = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [ticketId]);

  const data = query.data;
  const now = Math.max(clock.now, data?.receivedAt ?? 0);
  const secondsLeft = data
    ? qrSecondsLeft(data.receivedAt, data.remainingSeconds, now)
    : 0;
  const view: QrView = clock.hidden
    ? "loading"
    : qrView({
        hasToken: Boolean(data),
        secondsLeft,
        errorStatus: statusOf(query.error),
      });
  return {
    view,
    secondsLeft,
    totalSeconds: data?.remainingSeconds ?? 30,
    token: view === "live" || view === "soon" ? data!.qrToken : null,
    error: query.error,
    retry: () => void query.refetch(),
  };
}
