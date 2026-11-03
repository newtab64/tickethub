// apps/web/src/app/(public)/waiting-room/page.tsx
"use client";

import { useEffect, useState, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Timer,
  Users,
  ShieldCheck,
  CheckCircle2,
  Radio,
  ArrowRight,
  Sparkles,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { EVENTS, getEventById } from "@/lib/events-catalog";
import { waitingRoomApi } from "@/lib/api/waiting-room";

function WaitingRoomWorkspace() {
  const searchParams = useSearchParams();
  const eventId =
    searchParams.get("eventId") || "evt-anh-trai-vuot-ngan-chong-gai";
  const rawInitialPos = searchParams.get("initialPos");
  const parsedPos = rawInitialPos ? Number(rawInitialPos) : 1;
  const startingPos = Number.isNaN(parsedPos) || parsedPos <= 0 ? 1 : parsedPos;

  const event = getEventById(eventId) ?? EVENTS[0]!;

  const [status, setStatus] = useState<"QUEUED" | "ADMITTED">("QUEUED");
  const [queuePosition, setQueuePosition] = useState<number>(startingPos);
  const [initialPosition, setInitialPosition] = useState<number>(startingPos);
  const [estimatedWaitSeconds, setEstimatedWaitSeconds] = useState<number>(
    Math.max(15, startingPos * 15),
  );
  const [queueId, setQueueId] = useState<string>(`q_${event.id}`);
  const [admissionToken, setAdmissionToken] = useState<string | null>(null);
  const [lastHeartbeatAt, setLastHeartbeatAt] =
    useState<string>("Đang đồng bộ");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function initQueue() {
      try {
        const res = await waitingRoomApi.joinQueue(eventId);
        if (!isMounted) return;
        setErrorMessage(null);

        const nowStr = new Date().toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        setLastHeartbeatAt(nowStr);

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
        if (res.queueId) setQueueId(res.queueId);
      } catch (err: unknown) {
        if (!isMounted) return;
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Đang chờ kết nối máy chủ hàng chờ...",
        );
      }
    }

    void initQueue();
    return () => {
      isMounted = false;
    };
  }, [eventId, startingPos]);

  useEffect(() => {
    if (status !== "QUEUED") return;

    const timer = setInterval(async () => {
      try {
        const hb = await waitingRoomApi.sendHeartbeat(eventId);
        const nowStr = new Date().toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        setLastHeartbeatAt(nowStr);
        setErrorMessage(null);

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
        if (hb.queueId) {
          setQueueId(hb.queueId);
        }
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Kết nối heartbeat gián đoạn, hệ thống đang thử lại...",
        );
      }
    }, 15000);

    return () => clearInterval(timer);
  }, [status, eventId]);

  const progressPercent =
    status === "ADMITTED"
      ? 100
      : Math.min(
          96,
          Math.max(
            10,
            Math.round(
              ((initialPosition - queuePosition) /
                Math.max(1, initialPosition)) *
                100,
            ),
          ),
        );

  const formatWaitTime = (secs: number) => {
    if (secs < 60) return `Khoảng ${secs} giây`;
    const mins = Math.ceil(secs / 60);
    return `Khoảng ${mins} phút`;
  };

  return (
    <div className="min-h-[calc(100vh-120px)] bg-muted py-10 px-4 flex items-center justify-center">
      <div className="w-full max-w-[540px] bg-background rounded-[20px] border border-border shadow-lg overflow-hidden">
        <div className="relative h-32 bg-foreground overflow-hidden">
          <Image
            src={event.image}
            alt={event.title}
            fill
            sizes="540px"
            className="object-cover opacity-45"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
          <div className="absolute bottom-3.5 left-5 right-5 text-white">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-bold mb-1">
              <Radio className="size-3 animate-pulse" />
              Phòng chờ phân luồng trực tuyến (UC03)
            </span>
            <h1 className="text-[17px] sm:text-[18px] font-extrabold truncate">
              {event.title}
            </h1>
          </div>
        </div>

        <div className="p-6 sm:p-7 space-y-6">
          {status !== "ADMITTED" ? (
            <>
              <div className="text-center space-y-1.5">
                <h2 className="text-[19px] font-extrabold text-foreground">
                  Bạn đang trong hàng chờ mua vé
                </h2>
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  Lượng khán giả truy cập sự kiện đang rất cao. Hệ thống tự động
                  duy trì kết nối (Heartbeat 15s) và sẽ chuyển bạn vào sơ đồ ghế
                  ngay khi đến lượt.
                </p>
              </div>

              {errorMessage && (
                <div className="rounded-[10px] bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-[12px] text-amber-900 flex items-center gap-2">
                  <AlertCircle className="size-4 text-amber-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3.5">
                <div className="rounded-[14px] bg-muted border border-border p-4 text-center space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
                    <Users className="size-4 text-primary" />
                    <span>Số thứ tự của bạn</span>
                  </div>
                  <div
                    data-testid="queue-position-value"
                    className="text-[28px] font-extrabold text-foreground font-mono tabular-nums"
                  >
                    #{queuePosition.toLocaleString("vi-VN")}
                  </div>
                </div>

                <div className="rounded-[14px] bg-muted border border-border p-4 text-center space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
                    <Timer className="size-4 text-primary" />
                    <span>Thời gian ước tính</span>
                  </div>
                  <div
                    data-testid="queue-wait-value"
                    className="text-[18px] font-extrabold text-primary pt-1.5 tabular-nums"
                  >
                    {formatWaitTime(estimatedWaitSeconds)}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-[12px] font-semibold">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <RefreshCw className="size-3.5 text-primary animate-spin" />
                    Đang cập nhật tiến độ hàng chờ...
                  </span>
                  <span
                    data-testid="queue-progress-percent"
                    className="text-primary font-mono font-bold"
                  >
                    {progressPercent}%
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                  <span>Mã phiên: {queueId}</span>
                  <span>Đồng bộ lúc: {lastHeartbeatAt}</span>
                </div>
              </div>

              <div className="rounded-[12px] bg-emerald-50/70 border border-emerald-200 p-3.5 flex items-start gap-2.5 text-[12px] text-emerald-900">
                <ShieldCheck className="size-4 text-primary shrink-0 mt-0.5" />
                <span>
                  <strong>Lưu ý quan trọng:</strong> Vui lòng không đóng trình
                  duyệt. Khi đến lượt, bạn sẽ được cấp{" "}
                  <strong>Admission Token</strong> có hiệu lực 10 phút để chọn
                  ghế và thanh toán.
                </span>
              </div>
            </>
          ) : (
            <div
              data-testid="queue-admitted-state"
              className="py-4 text-center space-y-4 animate-in zoom-in-95 duration-200"
            >
              <div className="mx-auto size-16 rounded-full bg-emerald-100 text-primary flex items-center justify-center">
                <CheckCircle2 className="size-9" />
              </div>

              <div className="space-y-1">
                <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-primary uppercase tracking-wider">
                  <Sparkles className="size-3.5" />
                  Đã cấp quyền truy cập (Admission Token)
                </span>
                <h2 className="text-[20px] font-extrabold text-foreground">
                  Đã đến lượt của bạn!
                </h2>
                <p className="text-[13px] text-muted-foreground">
                  Bạn đã được cấp quyền vào sơ đồ chọn chỗ ngồi của sự kiện.
                </p>
              </div>

              {admissionToken && (
                <div className="pt-2">
                  <Link
                    href={`/events/${eventId}?modal=false`}
                    data-testid="enter-booking-now-btn"
                    className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-[10px] bg-primary hover:bg-emerald-700 text-primary-foreground text-[14px] font-bold transition-colors shadow-xs"
                  >
                    <span>Vào chọn ghế ngay</span>
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WaitingRoomPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh] flex items-center justify-center text-sm text-muted-foreground">
          Đang kết nối phòng chờ sự kiện...
        </div>
      }
    >
      <WaitingRoomWorkspace />
    </Suspense>
  );
}
