"use client";

import { Suspense, useState, useEffect, useMemo, useCallback } from "react";
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
  Clock,
  Printer,
  Mail,
  RefreshCw,
  AlertCircle,
  Info,
  Copy,
  Check,
} from "lucide-react";
import { EVENTS, getEventById, type EventItem } from "@/lib/events-catalog";
import {
  renderTicketEmailHtml,
  type TicketEmailData,
} from "@/lib/email-templates/ticket-email";
import { issueDynamicQrToken } from "@/lib/checkin-engine";

export type TicketStatus = "VALID" | "CHECKED_IN" | "CANCELLED";

export interface TicketItem {
  id: string;
  orderCode: string;
  ticketCode: string;
  eventId: string;
  event: EventItem;
  zoneName: string;
  rowLabel: string;
  seatNumbers: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: TicketStatus;
  gateInfo: string;
  purchaseDate: string;
  recipientName: string;
  recipientEmail: string;
}

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

function MyTicketsContent() {
  const searchParams = useSearchParams();
  const queryEventId = searchParams.get("event") ?? "";
  const queryOrderCode = searchParams.get("order");
  const queryZone = searchParams.get("zone");
  const queryRow = searchParams.get("row");
  const queryQty = searchParams.get("qty");
  const queryPrice = searchParams.get("price");

  // Selected ticket filter tab
  const [filterTab, setFilterTab] = useState<"ALL" | TicketStatus>("ALL");

  // Selected ticket for modal details & QR inspection
  const [selectedTicketId, setSelectedTicketId] = useState<string>("");

  // Modals
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isGateGuideModalOpen, setIsGateGuideModalOpen] = useState(false);
  const [copiedEmailHtml, setCopiedEmailHtml] = useState(false);

  // Dynamic QR Code countdown timer (30-second token refresh cycle for Phase 3 Ed25519)
  const QR_REFRESH_CYCLE_SEC = 30;
  const [countdownSeconds, setCountdownSeconds] =
    useState<number>(QR_REFRESH_CYCLE_SEC);
  const [tokenNonce, setTokenNonce] = useState<number>(0);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [isRefreshingQr, setIsRefreshingQr] = useState<boolean>(false);
  const [isNetworkOffline, setIsNetworkOffline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );

  // Build list of tickets (supporting query parameters or default comprehensive catalog)
  const ticketsList: TicketItem[] = useMemo(() => {
    const list: TicketItem[] = [];

    // If navigated with checkout query parameters, put that ticket at the top
    if (queryOrderCode || queryEventId) {
      const activeEv = getEventById(queryEventId) ?? EVENTS[0];
      const qQty = Math.max(1, parseInt(queryQty ?? "2", 10) || 2);
      const qPrice = parseInt(queryPrice ?? "1800000", 10) || 1800000;
      const qRow = queryRow ?? "Hàng 12";
      const qZone = queryZone ?? "VIP BẠC";
      const derivedSeats = Array.from({ length: qQty }, (_, i) => {
        const baseNum = (qPrice % 40) + 1 + i;
        return `${qRow ? qRow.replace(/[^0-9A-Za-z]/g, "").slice(0, 3) : "S"}-${String(baseNum).padStart(2, "0")}`;
      }).join(", ");

      list.push({
        id: `tkt-${queryOrderCode || "88412"}`,
        orderCode: queryOrderCode || "ORD-88412",
        ticketCode: `TKT-VN-${(queryOrderCode || "88412").replace(/\D/g, "")}`,
        eventId: activeEv.id,
        event: activeEv,
        zoneName: qZone,
        rowLabel: qRow,
        seatNumbers: derivedSeats,
        quantity: qQty,
        unitPrice: qPrice,
        totalPrice: qPrice * qQty,
        status: "VALID",
        gateInfo: "Cổng B - Cửa B2 (Khán đài Tây)",
        purchaseDate: "28/10/2026 14:30",
        recipientName: "Trần Phú An",
        recipientEmail: "tranphuan68686868@gmail.com",
      });
    }

    // Default sample ticket 1: Anh Trai "Say Hi" Concert 2026 (VALID - Sắp diễn ra)
    if (!list.some((t) => t.orderCode === "ORD-88412")) {
      list.push({
        id: "tkt-order-88412",
        orderCode: "ORD-88412",
        ticketCode: "TKT-VN-88412-V01",
        eventId: EVENTS[0].id,
        event: EVENTS[0],
        zoneName: "VIP BẠC",
        rowLabel: "Hàng 12",
        seatNumbers: "H12-05, H12-06",
        quantity: 2,
        unitPrice: 1800000,
        totalPrice: 3600000,
        status: "VALID",
        gateInfo: "Cổng B - Cửa B2 (Khán đài Tây)",
        purchaseDate: "28/10/2026 14:30",
        recipientName: "Trần Phú An",
        recipientEmail: "tranphuan68686868@gmail.com",
      });
    }

    // Ticket 2: V-League CAHN vs Nam Định (CHECKED_IN - Đã soát vé)
    if (EVENTS[1]) {
      list.push({
        id: "tkt-order-77291",
        orderCode: "ORD-77291",
        ticketCode: "TKT-VN-77291-A08",
        eventId: EVENTS[1].id,
        event: EVENTS[1],
        zoneName: "Khán đài A (Tầng 2)",
        rowLabel: "Hàng 08",
        seatNumbers: "A8-14",
        quantity: 1,
        unitPrice: 350000,
        totalPrice: 350000,
        status: "CHECKED_IN",
        gateInfo: "Cổng A - Cửa A1 (Khán đài chính)",
        purchaseDate: "20/10/2026 09:15",
        recipientName: "Trần Phú An",
        recipientEmail: "tranphuan68686868@gmail.com",
      });
    }

    // Ticket 3: Vũ Concert "Bảo Tàng Của Nuối Tiếc" (CANCELLED - Đã hoàn tiền)
    if (EVENTS[2]) {
      list.push({
        id: "tkt-order-65103",
        orderCode: "ORD-65103",
        ticketCode: "TKT-VN-65103-C03",
        eventId: EVENTS[2].id,
        event: EVENTS[2],
        zoneName: "Khu Vực Phổ Thông CAT 2",
        rowLabel: "Tự do",
        seatNumbers: "GA-103, GA-104",
        quantity: 2,
        unitPrice: 650000,
        totalPrice: 1300000,
        status: "CANCELLED",
        gateInfo: "Cổng C (Khán đài Đông)",
        purchaseDate: "12/10/2026 16:45",
        recipientName: "Trần Phú An",
        recipientEmail: "tranphuan68686868@gmail.com",
      });
    }

    return list;
  }, [queryOrderCode, queryEventId, queryZone, queryRow, queryQty, queryPrice]);

  const activeTicket =
    ticketsList.find((t) => t.id === selectedTicketId) || ticketsList[0];

  // Filtered tickets by status tab
  const filteredTickets = useMemo(() => {
    if (filterTab === "ALL") return ticketsList;
    return ticketsList.filter((t) => t.status === filterTab);
  }, [ticketsList, filterTab]);

  // UC05-E6: Detect network status so we warn the buyer when offline
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOffline = () => setIsNetworkOffline(true);
    const onOnline = () => {
      setIsNetworkOffline(false);
      setTokenNonce(Date.now());
      setCountdownSeconds(QR_REFRESH_CYCLE_SEC);
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  // 30-second Dynamic QR Countdown & Auto-Refresh
  useEffect(() => {
    if (!activeTicket || activeTicket.status !== "VALID") return;
    const timer = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          setTokenNonce(Date.now());
          return QR_REFRESH_CYCLE_SEC;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeTicket]);

  // Manual QR Refresh Handler
  const handleManualRefreshQr = useCallback(() => {
    setIsRefreshingQr(true);
    setTokenNonce(Date.now());
    setCountdownSeconds(QR_REFRESH_CYCLE_SEC);
    setTimeout(() => {
      setIsRefreshingQr(false);
    }, 200);
  }, []);

  // Generate Dynamic QR Payload & Image once per 30s cycle or ticket switch (UC05 & API_CONTRACT.md)
  useEffect(() => {
    if (!activeTicket || activeTicket.status !== "VALID") return;

    let cancelled = false;
    const renderQr = (qrToken: string) => {
      QRCode.toDataURL(qrToken, {
        width: 420,
        margin: 1,
        errorCorrectionLevel: "H",
      })
        .then((url) => {
          if (!cancelled) setQrDataUrl(url);
        })
        .catch((err) => console.error("QR Code generation error:", err));
    };

    const fallbackLocalToken = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const issued = issueDynamicQrToken(
        {
          id: activeTicket.id,
          ticketCode: activeTicket.ticketCode,
          orderCode: activeTicket.orderCode,
          eventId: activeTicket.eventId,
          zoneName: activeTicket.zoneName,
          rowLabel: activeTicket.rowLabel,
          seatNumbers: activeTicket.seatNumbers,
        },
        nowSec,
        `jti-${activeTicket.id}-${tokenNonce || nowSec}`,
      );
      renderQr(issued.qrToken);
    };

    const params = new URLSearchParams({
      ticketCode: activeTicket.ticketCode,
      orderCode: activeTicket.orderCode,
      eventId: activeTicket.eventId,
      zoneName: activeTicket.zoneName,
      rowLabel: activeTicket.rowLabel,
      seatNumbers: activeTicket.seatNumbers,
    });

    fetch(
      `/api/v1/tickets/${encodeURIComponent(activeTicket.id)}/dynamic-qr?${params.toString()}`,
    )
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("API fallback")),
      )
      .then((json) => {
        if (!cancelled && json?.data?.qrToken) {
          renderQr(json.data.qrToken);
        } else if (!cancelled) {
          fallbackLocalToken();
        }
      })
      .catch(() => {
        if (!cancelled) fallbackLocalToken();
      });

    return () => {
      cancelled = true;
    };
  }, [activeTicket, tokenNonce]);

  // Screen Wake Lock API: Keep screen awake & maximum contrast while QR modal is open (W05-FE2)
  useEffect(() => {
    if (!isQrModalOpen || typeof navigator === "undefined") return;
    let wakeLockSentinel: { release: () => Promise<void> } | null = null;
    const nav = navigator as unknown as {
      wakeLock?: {
        request: (type: "screen") => Promise<{ release: () => Promise<void> }>;
      };
    };
    if (nav.wakeLock?.request) {
      nav.wakeLock
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

  // Print ticket trigger
  const handlePrintTicket = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  // Render HTML email preview string
  const emailHtml = useMemo(() => {
    if (!activeTicket) return "";
    const emailData: TicketEmailData = {
      recipientName: activeTicket.recipientName,
      recipientEmail: activeTicket.recipientEmail,
      orderCode: activeTicket.orderCode,
      ticketCode: activeTicket.ticketCode,
      eventName: activeTicket.event.title,
      eventImage: activeTicket.event.image,
      eventDate: activeTicket.event.fullDateTime,
      eventTime: activeTicket.event.doorsOpenTime || "19:00",
      eventVenue: activeTicket.event.venue,
      eventAddress: activeTicket.event.venueAddress || activeTicket.event.city,
      zoneName: activeTicket.zoneName,
      rowLabel: activeTicket.rowLabel,
      seatNumbers: activeTicket.seatNumbers,
      quantity: activeTicket.quantity,
      totalPrice: activeTicket.totalPrice,
      paymentMethod: "Cổng thanh toán điện tử VNPay",
      paymentTime: activeTicket.purchaseDate,
      gateInfo: activeTicket.gateInfo,
      qrCodeDataUrl: qrDataUrl,
    };
    return renderTicketEmailHtml(emailData);
  }, [activeTicket, qrDataUrl]);

  const handleCopyEmailHtml = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(emailHtml).then(() => {
        setCopiedEmailHtml(true);
        setTimeout(() => setCopiedEmailHtml(false), 2000);
      });
    }
  };

  const getStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case "VALID":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[12px] font-bold">
            <CheckCircle2 className="size-3.5" /> Hợp lệ • Sắp diễn ra
          </span>
        );
      case "CHECKED_IN":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-foreground text-[12px] font-bold">
            <Check className="size-3.5" /> Đã sử dụng • Đã soát vé
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-[12px] font-bold">
            <AlertCircle className="size-3.5" /> Đã hủy • Đã hoàn tiền
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto pb-16">
      {/* 1. Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Vé của tôi
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Quản lý vé điện tử, mã QR vào cổng và xác nhận đơn hàng.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {activeTicket && (
            <Link
              href={`/events/${activeTicket.event.id}`}
              className="inline-flex items-center gap-1.5 justify-center h-9 px-3.5 rounded-[8px] border border-border bg-background text-foreground text-xs font-medium hover:bg-muted transition-colors"
            >
              <Ticket className="size-3.5 text-muted-foreground" />
              Xem sự kiện
            </Link>
          )}

          <button
            type="button"
            onClick={handlePrintTicket}
            className="inline-flex items-center gap-1.5 justify-center h-9 px-3.5 rounded-[8px] border border-border bg-background text-foreground text-xs font-medium hover:bg-muted transition-colors"
          >
            <Printer className="size-3.5 text-muted-foreground" />
            In vé / Lưu PDF
          </button>

          <button
            type="button"
            onClick={() => setIsEmailModalOpen(true)}
            className="inline-flex items-center gap-1.5 justify-center h-9 px-3.5 rounded-[8px] bg-primary hover:bg-emerald-700 text-primary-foreground text-xs font-semibold transition-colors"
          >
            <Mail className="size-3.5" />
            Xem vé qua Email
          </button>
        </div>
      </div>

      {/* 2. Status Filter Tabs (DESIGN_TOKENS.md Nút lọc: h-9 rounded-[8px]) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 print:hidden">
        {[
          { key: "ALL", label: `Tất cả (${ticketsList.length})` },
          {
            key: "VALID",
            label: `Sắp diễn ra (${ticketsList.filter((t) => t.status === "VALID").length})`,
          },
          {
            key: "CHECKED_IN",
            label: `Đã sử dụng (${ticketsList.filter((t) => t.status === "CHECKED_IN").length})`,
          },
          {
            key: "CANCELLED",
            label: `Đã hủy (${ticketsList.filter((t) => t.status === "CANCELLED").length})`,
          },
        ].map((tab) => {
          const isSelected = filterTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilterTab(tab.key as "ALL" | TicketStatus)}
              className={`h-9 px-3.5 rounded-[8px] text-[13px] transition-colors whitespace-nowrap ${
                isSelected
                  ? "border-[1.5px] border-primary bg-emerald-50/50 text-primary font-semibold"
                  : "border border-border bg-background text-foreground font-medium hover:bg-muted"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 3. Main Ticket Workspace: Master-Detail Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT COLUMN (Ticket Selector List) - 5 cols */}
        <div className="lg:col-span-5 space-y-3 print:hidden">
          <div className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
            Danh sách đơn vé ({filteredTickets.length})
          </div>

          {filteredTickets.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-border p-8 text-center text-muted-foreground text-[13px]">
              Không có vé nào trong danh mục này
            </div>
          ) : (
            filteredTickets.map((t) => {
              const isSelected = t.id === selectedTicketId;
              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTicketId(t.id)}
                  className={`p-4 rounded-[14px] border transition-all cursor-pointer text-left relative ${
                    isSelected
                      ? "border-primary bg-emerald-50/20 dark:bg-emerald-950/20 shadow-xs ring-1 ring-primary"
                      : "border-border bg-background hover:border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-mono text-[11px] font-bold text-muted-foreground">
                      #{t.orderCode}
                    </span>
                    {getStatusBadge(t.status)}
                  </div>

                  <h3 className="font-bold text-[15px] text-foreground line-clamp-1">
                    {t.event.title}
                  </h3>

                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground mt-1">
                    <Calendar className="size-3.5 text-primary shrink-0" />
                    <span>{t.event.fullDateTime}</span>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60 text-[12px]">
                    <span className="font-medium text-foreground">
                      {t.zoneName} • {t.quantity} vé
                    </span>
                    <span className="font-extrabold text-foreground">
                      {formatVnd(t.totalPrice)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* RIGHT COLUMN (Detailed Boarding Pass Ticket & Dynamic QR) - 7 cols */}
        <div className="lg:col-span-7">
          {activeTicket ? (
            <div className="rounded-[16px] border border-border bg-background shadow-xs overflow-hidden print:border-none print:shadow-none">
              {/* Boarding Pass Header Card */}
              <div className="p-6 sm:p-7 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {getStatusBadge(activeTicket.status)}
                  <span className="text-[12px] font-mono font-bold text-muted-foreground">
                    MÃ ĐƠN #{activeTicket.orderCode}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                  {}
                  <Image
                    src={activeTicket.event.image}
                    alt={activeTicket.event.title}
                    width={144}
                    height={90}
                    unoptimized
                    className="w-full sm:w-36 aspect-[16/10] object-cover rounded-[12px] bg-secondary shrink-0 border border-border/80"
                  />
                  <div className="space-y-1.5 min-w-0">
                    <h2 className="text-[19px] sm:text-[21px] font-extrabold text-foreground leading-tight">
                      {activeTicket.event.title}
                    </h2>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground pt-0.5">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="size-4 text-primary shrink-0" />{" "}
                        {activeTicket.event.fullDateTime}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="size-4 text-primary shrink-0" />{" "}
                        {activeTicket.event.venue}, {activeTicket.event.city}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Seating Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 rounded-[12px] bg-muted/60 border border-border p-4">
                  <div>
                    <span className="block text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Khu vực (Zone)
                    </span>
                    <span className="font-bold text-[14px] text-foreground">
                      {activeTicket.zoneName}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Hàng ghế (Row)
                    </span>
                    <span className="font-mono font-bold text-[14px] text-foreground">
                      {activeTicket.rowLabel}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Số ghế ({activeTicket.quantity} vé)
                    </span>
                    <span className="font-mono font-bold text-[14px] text-primary">
                      {activeTicket.seatNumbers}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Tổng tiền
                    </span>
                    <span className="font-extrabold text-[14px] text-foreground">
                      {formatVnd(activeTicket.totalPrice)}
                    </span>
                  </div>
                </div>

                {/* Gate & Entry Recommendations */}
                <div className="flex items-center justify-between p-3 rounded-[10px] bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 text-[12px]">
                  <div className="flex items-center gap-2">
                    <Info className="size-4 text-emerald-600 shrink-0" />
                    <span className="font-medium text-emerald-900 dark:text-emerald-300">
                      Cổng vào khuyến nghị:{" "}
                      <strong>{activeTicket.gateInfo}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsGateGuideModalOpen(true)}
                    className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline shrink-0 text-[11px]"
                  >
                    Xem chỉ dẫn &rarr;
                  </button>
                </div>
              </div>

              {/* Perforated Boarding-Pass Divider (Classic Airline / Concert Notch) */}
              <div className="relative py-1">
                <div className="absolute left-0 -top-3 size-6 bg-muted rounded-r-full border-r border-border" />
                <div className="border-t-2 border-dashed border-border mx-6" />
                <div className="absolute right-0 -top-3 size-6 bg-muted rounded-l-full border-l border-border" />
              </div>

              {/* Dynamic QR Code Pass Container */}
              <div className="p-6 sm:p-7 bg-muted/20 space-y-4">
                {isNetworkOffline && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-900 flex items-center gap-2">
                    <AlertCircle className="size-4 text-amber-600 shrink-0" />
                    <span>
                      Thiết bị đang mất kết nối mạng. Vui lòng kết nối Internet
                      khi qua cổng để mã QR động được đồng bộ mới nhất.
                    </span>
                  </div>
                )}

                {activeTicket.status !== "VALID" ? (
                  <div className="bg-background rounded-lg border border-border p-6 text-center space-y-2">
                    <div className="inline-flex items-center justify-center size-10 rounded-full bg-muted text-muted-foreground">
                      <AlertCircle className="size-5" />
                    </div>
                    <h4 className="text-sm font-semibold text-foreground">
                      {activeTicket.status === "CANCELLED"
                        ? "Vé đã bị hủy - Không cấp mã QR vào cổng"
                        : "Vé đã được sử dụng qua cổng kiểm soát"}
                    </h4>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      {activeTicket.status === "CANCELLED"
                        ? "Đơn vé này đã được hủy và hoàn tiền theo chính sách sự kiện. Mã QR động đã bị vô hiệu hóa."
                        : "Vé này đã hoàn tất soát vé tại cổng. Hệ thống không cấp lại mã QR động cho vé đã qua cổng."}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">
                          Mã QR vào cổng
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Mã tự động làm mới sau mỗi {QR_REFRESH_CYCLE_SEC}{" "}
                          giây. Vui lòng xuất trình trực tiếp trên màn hình khi
                          qua cổng.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleManualRefreshQr}
                        disabled={isRefreshingQr}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] border border-border bg-background text-xs font-medium hover:bg-muted text-foreground transition-colors self-start sm:self-auto shrink-0"
                      >
                        <RefreshCw
                          className={`size-3 text-muted-foreground ${
                            isRefreshingQr ? "animate-spin text-primary" : ""
                          }`}
                        />
                        Làm mới mã
                      </button>
                    </div>

                    {/* QR Display Card with Live 30s Countdown Bar */}
                    <div className="bg-background rounded-lg border border-border p-5 flex flex-col sm:flex-row items-center gap-6">
                      {/* QR Image Box */}
                      <div className="relative group shrink-0">
                        <div className="size-44 sm:size-48 p-2 rounded-lg border border-border bg-white flex items-center justify-center">
                          {qrDataUrl ? (
                            <Image
                              src={qrDataUrl}
                              alt={`QR Code ${activeTicket.orderCode}`}
                              width={192}
                              height={192}
                              unoptimized
                              className="size-full object-contain"
                            />
                          ) : (
                            <QrCode className="size-16 text-muted-foreground animate-pulse" />
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsQrModalOpen(true)}
                          className="absolute inset-0 bg-black/50 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-xs font-semibold"
                        >
                          <QrCode className="size-5" />
                          <span>Phóng to mã QR</span>
                        </button>
                      </div>

                      {/* QR Dynamic Timer & Controls */}
                      <div className="flex-1 space-y-3 w-full">
                        {/* Countdown bar */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                              <Clock className="size-3.5 text-primary" /> Thời
                              gian hiệu lực:
                            </span>
                            <span className="font-mono font-semibold text-primary">
                              {countdownSeconds} giây
                            </span>
                          </div>

                          {/* Animated Progress Bar */}
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              style={{
                                width: `${(countdownSeconds / QR_REFRESH_CYCLE_SEC) * 100}%`,
                              }}
                              className="h-full bg-primary transition-all duration-1000 ease-linear rounded-full"
                            />
                          </div>
                        </div>

                        <div className="space-y-1 text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg border border-border">
                          <div>
                            Mã vé:{" "}
                            <strong className="font-mono text-foreground">
                              {activeTicket.ticketCode}
                            </strong>
                          </div>
                          <div>
                            Khách hàng:{" "}
                            <strong className="text-foreground">
                              {activeTicket.recipientName}
                            </strong>
                          </div>
                          <div>
                            Cổng soát vé:{" "}
                            <strong className="text-foreground">
                              {activeTicket.gateInfo}
                            </strong>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsQrModalOpen(true)}
                          className="w-full h-9 rounded-[8px] bg-primary hover:bg-emerald-700 text-primary-foreground text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                        >
                          <QrCode className="size-3.5" />
                          Mở mã QR toàn màn hình
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* 4. Fullscreen QR Code Modal for Turnstile Scanning */}
      {isQrModalOpen && activeTicket && activeTicket.status === "VALID" && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-background text-foreground rounded-[16px] border border-border max-w-sm w-full p-6 shadow-lg relative">
            <button
              type="button"
              onClick={() => setIsQrModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="size-4" />
            </button>

            <div className="text-center space-y-1 mb-4">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-medium">
                <ShieldCheck className="size-3.5 text-primary" /> Vé hợp lệ
              </span>
              <h3 className="text-base font-bold text-foreground pt-1 line-clamp-1">
                {activeTicket.event.title}
              </h3>
              <p className="text-xs text-muted-foreground font-mono">
                #{activeTicket.orderCode}
              </p>
            </div>

            {/* High-Contrast QR Code for Turnstile Scanners */}
            <div className="bg-white border border-border rounded-lg p-4 flex flex-col items-center justify-center">
              {qrDataUrl && (
                <Image
                  src={qrDataUrl}
                  alt={`QR Code ${activeTicket.orderCode}`}
                  width={240}
                  height={240}
                  unoptimized
                  className="w-60 h-60 object-contain"
                />
              )}

              {/* Live countdown */}
              <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground font-mono">
                <Clock className="size-3.5 text-primary" />
                <span>Làm mới sau: {countdownSeconds}s</span>
              </div>
            </div>

            {/* Quick Ticket Summary */}
            <div className="mt-4 p-3 bg-muted/40 rounded-lg border border-border text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Khu vực &amp; Ghế:
                </span>
                <span className="font-semibold text-foreground">
                  {activeTicket.zoneName} • {activeTicket.seatNumbers}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cổng vào:</span>
                <span className="font-semibold text-primary">
                  {activeTicket.gateInfo}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={handleManualRefreshQr}
                className="w-full h-9 rounded-[8px] bg-primary hover:bg-emerald-700 text-primary-foreground text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw className="size-3.5" />
                Làm mới mã QR
              </button>
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="w-full h-9 rounded-[8px] border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Live HTML Email Template Preview Modal */}
      {isEmailModalOpen && activeTicket && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3 sm:p-6">
          <div className="bg-background text-foreground rounded-[16px] border border-border max-w-3xl w-full h-[88vh] flex flex-col shadow-lg relative overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:px-6 border-b border-border flex items-center justify-between bg-muted/40 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Mail className="size-4 text-primary" /> Mẫu Email vé HTML
                  (Gmail, Outlook, Apple Mail)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Thiết kế Table-based layout, inline CSS, tương thích các ứng
                  dụng email.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyEmailHtml}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors"
                >
                  {copiedEmailHtml ? (
                    <>
                      <Check className="size-3.5 text-primary" /> Đã sao chép
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" /> Sao chép HTML
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEmailModalOpen(false)}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Email Preview Frame */}
            <div className="flex-1 bg-muted overflow-y-auto p-4 sm:p-6">
              <iframe
                title="Email Template Preview"
                srcDoc={emailHtml}
                className="w-full h-full min-h-[600px] border border-border rounded-lg bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* 6. Gate Check-in Instructions Modal */}
      {isGateGuideModalOpen && activeTicket && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-background text-foreground rounded-[16px] border border-border max-w-md w-full p-6 shadow-lg relative">
            <button
              type="button"
              onClick={() => setIsGateGuideModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="size-4" />
            </button>

            <h3 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
              <Info className="size-4 text-primary" /> Hướng dẫn vào cổng &amp;
              Soát vé
            </h3>

            <div className="space-y-3 text-xs text-muted-foreground">
              <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-200">
                <strong className="text-emerald-900 block text-[11px] uppercase">
                  Vị trí cổng đề xuất:
                </strong>
                <p className="text-emerald-800 font-semibold text-sm mt-0.5">
                  {activeTicket.gateInfo}
                </p>
              </div>

              <ul className="space-y-2 list-disc list-inside leading-relaxed">
                <li>
                  <strong>Thời gian mở cổng:</strong> Cổng kiểm soát sẽ mở trước
                  giờ diễn <strong>120 phút</strong>.
                </li>
                <li>
                  <strong>Mã QR động:</strong> Xuất trình mã QR trực tiếp trên
                  màn hình ứng dụng TicketHub. Ảnh chụp màn hình tĩnh không được
                  chấp nhận.
                </li>
                <li>
                  <strong>Giấy tờ tùy thân:</strong> Vui lòng mang theo CCCD/Hộ
                  chiếu có tên trùng khớp với thông tin đơn hàng (
                  {activeTicket.recipientName}).
                </li>
                <li>
                  <strong>Vật dụng cấm:</strong> Không mang theo máy ảnh chuyên
                  nghiệp có ống kính rời, vũ khí, chất cháy nổ hoặc đồ ăn thức
                  uống từ bên ngoài.
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => setIsGateGuideModalOpen(false)}
              className="mt-5 w-full h-9 rounded-[8px] bg-primary hover:bg-emerald-700 text-primary-foreground text-xs font-semibold transition-colors"
            >
              Đã hiểu
            </button>
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
        <div className="py-16 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Clock className="size-4 animate-spin text-primary" />
          <span>Đang tải thông tin vé điện tử...</span>
        </div>
      }
    >
      <MyTicketsContent />
    </Suspense>
  );
}
