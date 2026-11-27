"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GetTicketQrResponseSchema } from "@tickethub/shared";
import { apiClient, ApiError } from "@/shared/api/client";
import {
  isQrRejection,
  qrElapsedMs,
  qrSecondsLeft,
  qrView,
  type QrView,
} from "../domain/ticket-qr";

// Lỗi không có mã HTTP (mất mạng, dữ liệu sai) được coi là lỗi tạm thời.
const statusOf = (error: unknown) =>
  error === null ? null : error instanceof ApiError ? error.status : 0;

const REQUEST_TIMEOUT_MS = 10_000;
const instant = () => ({ wall: Date.now(), mono: performance.now() });

/** Vòng đời mã QR của một vé: xin mã, đếm lùi, đổi mã khi hết hạn. */
export function useTicketQr(ticketId: string | null) {
  const query = useQuery({
    queryKey: ["ticket-qr", ticketId],
    queryFn: async () => {
      const sentAt = instant();
      const data = GetTicketQrResponseSchema.parse(
        await apiClient<unknown>(
          `/tickets/${encodeURIComponent(ticketId!)}/qr`,
          // Yêu cầu treo phải thành lỗi để người dùng thử lại được.
          { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
        ),
      );
      if (data.ticketId !== ticketId) throw new Error("Mã QR không khớp vé.");
      return { ...data, sentAt };
    },
    enabled: ticketId !== null,
    // Mã không được nằm lại trong cache sau khi đóng hộp thoại.
    gcTime: 0,
    retry: false,
    // Mất sóng vẫn phải gọi và nhận lỗi, không tạm dừng trong im lặng.
    networkMode: "always",
    // Hẹn lần xin tiếp theo đúng lúc mã hết hạn; lỗi thì chờ người dùng thử lại.
    // TanStack không gọi khi tab ẩn.
    refetchInterval: ({ state }) =>
      state.error || !state.data
        ? false
        : Math.max(
            500,
            state.data.remainingSeconds * 1000 -
              qrElapsedMs(state.data.sentAt, instant()),
          ),
    refetchOnWindowFocus: ({ state }) =>
      isQrRejection(statusOf(state.error)) ? false : "always",
  });

  // Đồng hồ hiển thị. Khi tab ẩn thì không vẽ mã, để lúc quay lại không lộ mã cũ.
  const [clock, setClock] = useState(() => ({
    now: instant(),
    hidden: false,
  }));
  useEffect(() => {
    if (ticketId === null) return;
    const tick = () =>
      setClock({
        now: instant(),
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
  const secondsLeft = data
    ? qrSecondsLeft(data.sentAt, data.remainingSeconds, clock.now)
    : 0;
  const view: QrView = clock.hidden
    ? "loading"
    : qrView({
        hasToken: Boolean(data),
        secondsLeft,
        // Đang thử lại thì hiện khung chờ thay vì giữ thông báo lỗi cũ.
        errorStatus: query.isFetching ? null : statusOf(query.error),
      });
  return {
    view,
    secondsLeft,
    totalSeconds: data?.remainingSeconds ?? 30,
    token: view === "live" || view === "soon" ? data!.qrToken : null,
    error: query.error,
    hadCode: Boolean(data),
    retry: () => void query.refetch(),
  };
}
