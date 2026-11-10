"use client";

import { Suspense, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import {
  Calendar,
  MapPin,
  QrCode,
  CheckCircle2,
  Ticket,
  X,
  ShieldCheck,
  Download,
  Clock,
} from "lucide-react";
import type { MyTicketItem, GetTicketQrResponse } from "@tickethub/shared";
import { EVENTS, getEventById } from "@/lib/events-catalog";
import { apiClient, getAccessToken } from "@/lib/api/client";

const QR_ROTATION_SECONDS = 30;

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

interface BoardingPassTicketView {
  ticketId: string;
  ticketCode: string;
  orderCode: string;
  eventId: string;
  eventTitle: string;
  eventBannerUrl: string;
  eventDateTime: string;
  eventVenue: string;
  eventCity: string;
  zoneName: string;
  rowLabel: string;
  seatNumbers: string;
  quantity: number;
  totalPrice: number;
  status: string;
  isFromApi: boolean;
}

function MyTicketsContent() {
  const searchParams = useSearchParams();
  const eventIdParam = searchParams.get("event") ?? "";
  const orderCodeParam = searchParams.get("order") ?? "ORD-88412";
  const zoneNameParam = searchParams.get("zone") ?? "VIP BẠC";
  const rowLabelParam = searchParams.get("row") ?? "Hàng 12";
  const quantityParam = Math.max(
    1,
    parseInt(searchParams.get("qty") ?? "2", 10) || 2,
  );
  const unitPriceParam =
    parseInt(searchParams.get("price") ?? "1800000", 10) || 1800000;
  const totalPriceParam = unitPriceParam * quantityParam;

  const fallbackEvent = getEventById(eventIdParam) ?? EVENTS[0];

  const fallbackSeatNumbers = Array.from({ length: quantityParam }, (_, i) => {
    const baseNum = (unitPriceParam % 40) + 1 + i;
    return `${rowLabelParam ? rowLabelParam.replace(/[^0-9A-Za-z]/g, "").slice(0, 3) : "S"}-${String(baseNum).padStart(2, "0")}`;
  }).join(", ");

  const defaultPass: BoardingPassTicketView = {
    ticketId: `tkt-${orderCodeParam.toLowerCase()}`,
    ticketCode: `TKT-${orderCodeParam}`,
    orderCode: orderCodeParam,
    eventId: fallbackEvent.id,
    eventTitle: fallbackEvent.title,
    eventBannerUrl: fallbackEvent.image,
    eventDateTime: fallbackEvent.fullDateTime,
    eventVenue: fallbackEvent.venue,
    eventCity: fallbackEvent.city,
    zoneName: zoneNameParam,
    rowLabel: rowLabelParam,
    seatNumbers: fallbackSeatNumbers,
    quantity: quantityParam,
    totalPrice: totalPriceParam,
    status: "VALID",
    isFromApi: false,
  };

  const [tickets, setTickets] = useState<BoardingPassTicketView[]>([
    defaultPass,
  ]);
  const [selectedTicket, setSelectedTicket] =
    useState<BoardingPassTicketView>(defaultPass);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrSecondsLeft, setQrSecondsLeft] =
    useState<number>(QR_ROTATION_SECONDS);
  const [qrRotationCycle, setQrRotationCycle] = useState<number>(0);

  // Load real buyer tickets from backend API when authenticated
  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    let cancelled = false;
    apiClient<MyTicketItem[]>("/tickets/my-tickets?limit=20")
      .then((items) => {
        if (cancelled || !Array.isArray(items) || items.length === 0) return;
        const mapped: BoardingPassTicketView[] = items.map((item) => ({
          ticketId: item.id,
          ticketCode: item.ticketCode,
          orderCode: item.orderCode,
          eventId: item.eventId,
          eventTitle: item.eventTitle,
          eventBannerUrl: item.eventBannerUrl || fallbackEvent.image,
          eventDateTime: new Date(item.eventStartTime).toLocaleString("vi-VN"),
          eventVenue: item.eventVenueName,
          eventCity: item.eventCity,
          zoneName: item.seatInfo?.zoneName || item.ticketTypeName,
          rowLabel: item.seatInfo?.rowLabel || "Tự do",
          seatNumbers:
            item.seatInfo?.seatNumber ||
            item.seatInfo?.formattedLabel ||
            item.ticketCode,
          quantity: 1,
          totalPrice: item.effectivePaidPrice || item.price,
          status: item.status,
          isFromApi: true,
        }));
        setTickets(mapped);
        setSelectedTicket(mapped[0]);
      })
      .catch(() => {
        // Keep query-param boarding pass fallback
      });

    return () => {
      cancelled = true;
    };
  }, [fallbackEvent.image]);

  useEffect(() => {
    let cancelled = false;
    const fallbackPayload = JSON.stringify({
      v: 2,
      ticketId: selectedTicket.ticketId,
      ticketCode: selectedTicket.ticketCode,
      order: selectedTicket.orderCode,
      event: selectedTicket.eventId,
      zone: selectedTicket.zoneName,
      seats: selectedTicket.seatNumbers,
      cycle: qrRotationCycle,
      exp: Math.floor(Date.now() / 1000) + QR_ROTATION_SECONDS,
    });

    const resolveToken =
      selectedTicket.isFromApi && getAccessToken()
        ? apiClient<GetTicketQrResponse>(
            `/tickets/${selectedTicket.ticketId}/qr`,
          )
            .then((qrRes) => {
              if (!cancelled && typeof qrRes?.remainingSeconds === "number") {
                setQrSecondsLeft(
                  Math.max(
                    1,
                    Math.min(QR_ROTATION_SECONDS, qrRes.remainingSeconds),
                  ),
                );
              }
              return qrRes?.qrToken || fallbackPayload;
            })
            .catch(() => fallbackPayload)
        : Promise.resolve(fallbackPayload);

    resolveToken
      .then((tokenPayload) =>
        QRCode.toDataURL(tokenPayload, {
          width: 400,
          margin: 1,
          errorCorrectionLevel: "M",
        }),
      )
      .then((url) => {
        if (!cancelled) {
          setQrDataUrl(url);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [selectedTicket, qrRotationCycle]);

  // 30-second dynamic QR countdown and rotation (UC05)
  useEffect(() => {
    const timer = setInterval(() => {
      setQrSecondsLeft((prev) => {
        if (prev <= 1) {
          setQrRotationCycle((c) => c + 1);
          return QR_ROTATION_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Automatic Screen WakeLock when QR modal is open at gate (UC05)
  useEffect(() => {
    if (!isQrModalOpen || typeof navigator === "undefined") return;
    let wakeLockSentinel: { release: () => Promise<void> } | null = null;

    if ("wakeLock" in navigator && navigator.wakeLock) {
      navigator.wakeLock
        .request("screen")
        .then((sentinel) => {
          wakeLockSentinel = sentinel;
        })
        .catch(() => undefined);
    }

    return () => {
      if (wakeLockSentinel) {
        void wakeLockSentinel.release().catch(() => undefined);
      }
    };
  }, [isQrModalOpen]);

  const activePass = tickets[0] ?? defaultPass;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-foreground">
            Vé của tôi
          </h1>
          <p className="text-[14px] text-muted-foreground">
            Quản lý các vé sự kiện điện tử bạn đã đặt trên tickethub
          </p>
        </div>
        <div className="flex items-center gap-2.5 self-start">
          <Link
            href={`/events/${activePass.eventId}`}
            className="inline-flex items-center gap-1.5 justify-center h-10 px-4 rounded-full border border-border bg-background text-foreground text-[13px] font-semibold hover:border-primary hover:text-primary transition-colors"
          >
            <Ticket className="size-4 text-primary" />
            Xem sơ đồ ghế
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center h-10 px-5 rounded-full bg-primary text-primary-foreground text-[13px] font-bold hover:bg-emerald-700 transition-colors"
          >
            Đăng nhập để đồng bộ vé
          </Link>
        </div>
      </div>

      {/* Boarding-Pass Style Event Tickets */}
      <div className="space-y-5">
        {tickets.map((pass) => (
          <div
            key={pass.ticketId}
            className="rounded-[16px] border border-border bg-background shadow-xs overflow-hidden max-w-3xl"
          >
            <div className="p-6 sm:p-7 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-primary text-[12px] font-bold">
                  <CheckCircle2 className="size-3.5" /> Vé hợp lệ • Đã thanh
                  toán qua VNPay
                </span>
                <span className="text-[12px] font-mono font-bold text-muted-foreground">
                  MÃ ĐƠN #{pass.orderCode}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                <Image
                  src={pass.eventBannerUrl}
                  alt={pass.eventTitle}
                  width={128}
                  height={80}
                  unoptimized
                  className="w-full sm:w-32 aspect-[16/10] object-cover rounded-[10px] bg-secondary shrink-0"
                />
                <div className="space-y-1.5">
                  <h2 className="text-[19px] sm:text-[21px] font-extrabold text-foreground">
                    {pass.eventTitle}
                  </h2>
                  <div className="flex flex-wrap items-center gap-4 text-[13px] text-muted-foreground pt-0.5">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="size-4 text-primary" />{" "}
                      {pass.eventDateTime}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-4 text-primary" />{" "}
                      {pass.eventVenue}, {pass.eventCity}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 rounded-[12px] bg-muted border border-border p-4">
                <div>
                  <span className="block text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Khu vực
                  </span>
                  <span className="font-bold text-[15px] text-foreground">
                    {pass.zoneName}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Hàng ghế
                  </span>
                  <span className="font-mono font-bold text-[15px] text-foreground">
                    {pass.rowLabel || "Tự do"}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Số ghế ({pass.quantity} vé)
                  </span>
                  <span className="font-mono font-bold text-[15px] text-primary">
                    {pass.seatNumbers}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Tổng thanh toán
                  </span>
                  <span className="font-extrabold text-[15px] text-foreground">
                    {formatVnd(pass.totalPrice)}
                  </span>
                </div>
              </div>
            </div>

            {/* Perforated Boarding-Pass Divider */}
            <div className="ticket-notch-horizontal border-t border-dashed border-border" />

            {/* Bottom QR Pass Bar */}
            <div className="px-6 sm:px-7 py-4 bg-muted/60 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-[10px] bg-background border border-border flex items-center justify-center text-foreground shrink-0 overflow-hidden">
                  {qrDataUrl ? (
                    <Image
                      src={qrDataUrl}
                      alt="Mã QR"
                      width={40}
                      height={40}
                      unoptimized
                      className="size-10 object-contain"
                    />
                  ) : (
                    <QrCode className="size-6 text-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-[13px] font-bold text-foreground">
                    Vé điện tử vào cổng chính thức
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    Xuất trình mã QR động 30s tại cổng soát vé {pass.eventVenue}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedTicket(pass);
                  setIsQrModalOpen(true);
                }}
                className="inline-flex items-center justify-center h-9 px-4 rounded-full bg-primary hover:bg-emerald-700 text-primary-foreground text-[12px] font-bold transition-colors shrink-0 shadow-xs"
              >
                Mở mã QR
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* QR Code Modal for Gate Check */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-background text-foreground rounded-[20px] max-w-sm w-full p-6 shadow-2xl border border-border relative animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setIsQrModalOpen(false)}
              aria-label="Đóng mã QR"
              className="absolute top-4 right-4 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="size-5" />
            </button>

            <div className="text-center space-y-1 mb-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-primary text-[11px] font-bold">
                <ShieldCheck className="size-3.5" /> Vé điện tử chính hãng • Đã
                xác thực
              </span>
              <h3 className="text-[17px] font-extrabold text-foreground pt-1">
                {selectedTicket.eventTitle}
              </h3>
              <p className="text-[12px] text-muted-foreground font-mono">
                MÃ ĐƠN #{selectedTicket.orderCode}
              </p>
            </div>

            {/* QR Code Container */}
            <div className="bg-muted border border-border rounded-[14px] p-4 flex flex-col items-center justify-center">
              {qrDataUrl && (
                <Image
                  src={qrDataUrl}
                  alt={`QR Code ${selectedTicket.orderCode}`}
                  width={224}
                  height={224}
                  unoptimized
                  className="w-56 h-56 object-contain rounded-lg bg-white p-2"
                />
              )}
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                <Clock className="size-3.5 text-primary" />
                <span>
                  Mã QR động tự làm mới sau{" "}
                  <strong className="font-mono text-primary">
                    {qrSecondsLeft}s
                  </strong>
                </span>
              </div>
            </div>

            {/* Seating Details */}
            <div className="mt-4 p-3 bg-muted/60 rounded-[10px] border border-border text-[12px] space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Khu vực:</span>
                <span className="font-bold text-foreground">
                  {selectedTicket.zoneName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Hàng ghế &amp; Ghế:
                </span>
                <span className="font-bold text-primary">
                  {selectedTicket.seatNumbers}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Địa điểm:</span>
                <span className="font-medium text-foreground">
                  {selectedTicket.eventVenue}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-5 space-y-2">
              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download={`tickethub-${selectedTicket.orderCode}.png`}
                  className="w-full h-10 rounded-[10px] bg-primary hover:bg-emerald-700 text-primary-foreground text-[13px] font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <Download className="size-4" />
                  Lưu ảnh mã QR về máy
                </a>
              )}
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="w-full h-9 rounded-[8px] border border-border bg-background hover:bg-muted text-[12px] font-semibold text-muted-foreground transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MyTicketsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-sm text-muted-foreground">
          Đang tải vé...
        </div>
      }
    >
      <MyTicketsContent />
    </Suspense>
  );
}
