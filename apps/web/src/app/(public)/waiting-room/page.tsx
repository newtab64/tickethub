// apps/web/src/app/(public)/waiting-room/page.tsx
"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { EVENTS, getEventById } from "@/lib/events-catalog";
import { waitingRoomApi, saveAdmissionToken } from "@/lib/api/waiting-room";

function WaitingRoomWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId =
    searchParams.get("eventId") || "evt-anh-trai-vuot-ngan-chong-gai";
  const rawInitialPos = searchParams.get("initialPos");
  const parsedPos = rawInitialPos ? Number(rawInitialPos) : 24;
  const startingPos =
    Number.isNaN(parsedPos) || parsedPos <= 0 ? 24 : parsedPos;

  const event = getEventById(eventId) ?? EVENTS[0]!;

  const [status, setStatus] = useState<"QUEUED" | "ADMITTED">("QUEUED");
  const [queuePosition, setQueuePosition] = useState<number>(startingPos);
  const [initialPosition, setInitialPosition] = useState<number>(startingPos);
  const [estimatedWaitSeconds, setEstimatedWaitSeconds] = useState<number>(
    Math.max(15, startingPos * 10),
  );
  const [admissionToken, setAdmissionToken] = useState<string | null>(null);
  const isUsingRealApiRef = useRef<boolean>(false);

  useEffect(() => {
    if (rawInitialPos !== null) {
      isUsingRealApiRef.current = false;
      return;
    }

    let isMounted = true;
    async function initQueue() {
      try {
        const res = await waitingRoomApi.joinQueue(eventId);
        if (!isMounted) return;
        isUsingRealApiRef.current = true;

        if (res.status === "ADMITTED" && res.admissionToken) {
          setAdmissionToken(res.admissionToken);
          setQueuePosition(0);
          setStatus("ADMITTED");
          return;
        }

        const pos = res.queuePosition ?? startingPos;
        setQueuePosition(pos);
        setInitialPosition(Math.max(pos, 1));
        setEstimatedWaitSeconds(res.estimatedWaitSeconds ?? pos * 15);
      } catch {
        if (!isMounted) return;
        isUsingRealApiRef.current = false;
      }
    }

    void initQueue();
    return () => {
      isMounted = false;
    };
  }, [eventId, rawInitialPos, startingPos]);

  useEffect(() => {
    if (status !== "QUEUED") return;

    const intervalMs = isUsingRealApiRef.current ? 15000 : 1200;

    const timer = setInterval(async () => {
      if (isUsingRealApiRef.current) {
        try {
          const hb = await waitingRoomApi.sendHeartbeat(eventId);
          if (hb.status === "ADMITTED" && hb.admissionToken) {
            setAdmissionToken(hb.admissionToken);
            setQueuePosition(0);
            setStatus("ADMITTED");
            return;
          }
          if (typeof hb.queuePosition === "number") {
            setQueuePosition(hb.queuePosition);
            setInitialPosition((prev) => Math.max(prev, hb.queuePosition!));
          }
          if (typeof hb.estimatedWaitSeconds === "number") {
            setEstimatedWaitSeconds(hb.estimatedWaitSeconds);
          }
          return;
        } catch {
          // Chuyển sang bước dự phòng nếu mạng gián đoạn
        }
      }

      setQueuePosition((prev) => {
        const step = Math.max(1, Math.ceil(prev * 0.5));
        const next = Math.max(0, prev - step);
        setEstimatedWaitSeconds(Math.max(5, next * 8));

        if (next === 0) {
          const fallbackToken = `adm_${eventId}_${Date.now()}`;
          saveAdmissionToken(eventId, fallbackToken);
          setAdmissionToken(fallbackToken);
          setStatus("ADMITTED");
        }
        return next;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [status, eventId]);

  const progressPercent =
    status === "ADMITTED"
      ? 100
      : Math.min(
          95,
          Math.max(
            8,
            Math.round(
              ((initialPosition - queuePosition) /
                Math.max(1, initialPosition)) *
                100,
            ),
          ),
        );

  const formatWaitTime = (secs: number) => {
    if (secs < 60) return `~${secs} giây`;
    const mins = Math.ceil(secs / 60);
    return `~${mins} phút`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="waiting-room-modal-heading"
      data-testid="waiting-room-popup-modal"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs p-4 flex items-center justify-center animate-in fade-in duration-150"
    >
      <div className="w-full max-w-[380px] bg-background rounded-[20px] shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150 relative">
        <button
          type="button"
          onClick={() => router.push(`/events/${event.id}?modal=false`)}
          aria-label="Đóng phòng chờ"
          className="absolute top-4 right-4 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          <X className="size-5" />
        </button>

        {status !== "ADMITTED" ? (
          <>
            <div className="text-center space-y-1 pt-1">
              <h1
                id="waiting-room-modal-heading"
                className="text-[19px] font-extrabold text-foreground"
              >
                Đang chờ vào chọn vé
              </h1>
              <p className="text-[13px] text-muted-foreground truncate">
                {event.title}
              </p>
            </div>

            <div className="rounded-[14px] bg-muted border border-border p-4 flex items-center justify-between">
              <div>
                <div className="text-[12px] text-muted-foreground">
                  Số thứ tự
                </div>
                <div
                  data-testid="queue-position-value"
                  className="text-[24px] font-extrabold text-foreground tabular-nums"
                >
                  #{queuePosition.toLocaleString("vi-VN")}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[12px] text-muted-foreground">
                  Dự kiến chờ
                </div>
                <div
                  data-testid="queue-wait-value"
                  className="text-[16px] font-bold text-primary tabular-nums pt-1"
                >
                  {formatWaitTime(estimatedWaitSeconds)}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                <span>Tiến độ hàng chờ</span>
                <span
                  data-testid="queue-progress-percent"
                  className="font-semibold text-foreground"
                >
                  {progressPercent}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <p className="text-[12px] text-muted-foreground text-center">
              Vui lòng giữ nguyên cửa sổ này để không mất lượt.
            </p>
          </>
        ) : (
          <div
            data-testid="queue-admitted-state"
            className="text-center space-y-4 pt-2"
          >
            <div className="space-y-1">
              <h1
                id="waiting-room-modal-heading"
                className="text-[20px] font-extrabold text-foreground"
              >
                Đã đến lượt của bạn
              </h1>
              <p className="text-[13px] text-muted-foreground">
                Bạn có 10 phút để chọn ghế và hoàn tất đặt vé.
              </p>
            </div>

            {admissionToken && (
              <Link
                href={`/events/${eventId}?modal=false`}
                data-testid="enter-booking-now-btn"
                className="w-full h-11 rounded-[10px] bg-primary hover:bg-emerald-700 text-primary-foreground text-[14px] font-bold inline-flex items-center justify-center transition-colors"
              >
                Tiếp tục chọn vé
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function WaitingRoomPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh] flex items-center justify-center text-sm text-muted-foreground">
          Đang kết nối phòng chờ...
        </div>
      }
    >
      <WaitingRoomWorkspace />
    </Suspense>
  );
}
