"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { EVENTS, getEventById } from "@/features/event";
import {
  QR_ROTATION_SECONDS,
  buildTicketFallbackQrPayload,
  filterTicketsByTab,
  mapApiTicketToView,
  type BoardingPassTicketView,
  type TicketFilterTab,
} from "../domain/ticket-rules";
import { fetchBuyerTickets, fetchDynamicTicketQr } from "../api/tickets-api";

export function useMyTicketsScreen() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get("event") ?? "";
  const orderCode = searchParams.get("order") ?? "ORD-88412";
  const zoneName = searchParams.get("zone") ?? "VIP BẠC";
  const rowLabel = searchParams.get("row") ?? "Hàng 12";
  const quantity = Math.max(
    1,
    parseInt(searchParams.get("qty") ?? "2", 10) || 2,
  );
  const unitPrice =
    parseInt(searchParams.get("price") ?? "1800000", 10) || 1800000;

  const activeEvent = useMemo(
    () => getEventById(eventId) ?? EVENTS[0],
    [eventId],
  );

  const defaultTicket: BoardingPassTicketView = useMemo(() => {
    const seatNumbers = Array.from({ length: quantity }, (_, i) => {
      const baseNum = (unitPrice % 40) + 1 + i;
      const prefix = rowLabel
        ? rowLabel.replace(/[^0-9A-Za-z]/g, "").slice(0, 3)
        : "S";
      return `${prefix}-${String(baseNum).padStart(2, "0")}`;
    }).join(", ");

    return {
      ticketId: "tkt-preview-01",
      ticketCode: `TH-${orderCode.replace(/[^0-9A-Z]/g, "")}-01`,
      orderCode,
      eventId: activeEvent.id,
      eventTitle: activeEvent.title,
      eventImage: activeEvent.image,
      fullDateTime: activeEvent.fullDateTime,
      venue: activeEvent.venue,
      city: activeEvent.city,
      zoneName,
      rowLabel,
      seatNumbers,
      quantity,
      totalPrice: unitPrice * quantity,
      status: "ISSUED",
      isFromApi: false,
    };
  }, [activeEvent, orderCode, zoneName, rowLabel, quantity, unitPrice]);

  const [tickets, setTickets] = useState<BoardingPassTicketView[]>([
    defaultTicket,
  ]);
  const [activeTab, setActiveTab] = useState<TicketFilterTab>("ALL");
  const [selectedTicket, setSelectedTicket] =
    useState<BoardingPassTicketView>(defaultTicket);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrSecondsLeft, setQrSecondsLeft] = useState(QR_ROTATION_SECONDS);
  const [qrRotationTick, setQrRotationTick] = useState(0);
  const [wakeLockActive, setWakeLockActive] = useState(false);

  // Tai danh sach ve thuc te tu may chu khi nguoi mua da dang nhap
  useEffect(() => {
    let cancelled = false;
    void fetchBuyerTickets(20).then((items) => {
      if (cancelled || !items || items.length === 0) return;
      const mapped = items.map((item) => {
        const matchedEvent = getEventById(item.eventId) ?? EVENTS[0];
        return mapApiTicketToView(item, matchedEvent.image);
      });
      setTickets(mapped);
      setSelectedTicket(mapped[0]!);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Tao anh ma QR moi khi doi ve hoac den chu ky lam moi 30 giay
  useEffect(() => {
    let cancelled = false;
    const fallbackPayload = buildTicketFallbackQrPayload(
      selectedTicket,
      qrRotationTick,
    );

    const resolveToken = selectedTicket.isFromApi
      ? fetchDynamicTicketQr(selectedTicket.ticketId).then(
          (res) => res?.qrToken || fallbackPayload,
        )
      : Promise.resolve(fallbackPayload);

    void resolveToken
      .then((payload) =>
        QRCode.toDataURL(payload, {
          width: 400,
          margin: 1,
          color: { dark: "#141d23", light: "#ffffff" },
          errorCorrectionLevel: "M",
        }),
      )
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [selectedTicket, qrRotationTick]);

  // Dem nguoc 30 giay va tu dong doi ma QR moi
  useEffect(() => {
    const timer = setInterval(() => {
      setQrSecondsLeft((prev) => {
        if (prev <= 1) {
          setQrRotationTick((t) => t + 1);
          return QR_ROTATION_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Giu man hinh sang khi dang mo ma QR tai cong soat ve
  useEffect(() => {
    if (!isQrModalOpen || typeof navigator === "undefined") {
      return;
    }
    let sentinel: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: {
        request: (type: "screen") => Promise<{ release: () => Promise<void> }>;
      };
    };

    if (nav.wakeLock) {
      void nav.wakeLock
        .request("screen")
        .then((s) => {
          sentinel = s;
          setWakeLockActive(true);
        })
        .catch(() => setWakeLockActive(false));
    }

    return () => {
      setWakeLockActive(false);
      if (sentinel) {
        void sentinel.release().catch(() => undefined);
      }
    };
  }, [isQrModalOpen]);

  const filteredTickets = useMemo(
    () => filterTicketsByTab(tickets, activeTab),
    [tickets, activeTab],
  );

  const openQrModal = (ticket: BoardingPassTicketView) => {
    setSelectedTicket(ticket);
    setIsQrModalOpen(true);
  };

  return {
    tickets,
    filteredTickets,
    activeTab,
    setActiveTab,
    selectedTicket,
    qrDataUrl,
    isQrModalOpen,
    setIsQrModalOpen,
    openQrModal,
    qrSecondsLeft,
    wakeLockActive,
  };
}

export type MyTicketsScreen = ReturnType<typeof useMyTicketsScreen>;
