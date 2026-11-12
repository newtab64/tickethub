"use client";

import { useState, useMemo, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  getEventVenueMapKey,
  getEventListings,
  type EventItem,
  type TicketListing,
  buildZoneInfoMap,
  filterListingsByZone,
} from "@/features/event";

import {
  computeRemainingSeconds,
  formatCountdown,
  getHoldErrorInfo,
  insufficientTicketsMessage,
  nowMs,
  parseHoldSession,
} from "../domain/booking-rules";
import {
  requestHold,
  requestRelease,
  releaseOnPageLeave,
} from "../api/booking-client";
import { useSession } from "@/features/identity";

/** Trang thai va hanh dong cua man hinh dat ve cho mot su kien. */
export function useBookingScreen(event: EventItem) {
  const { user } = useSession();
  const isAdmin = user?.role === "ADMIN";
  const isOrganizer = user?.role === "ORGANIZER";
  const cannotBuyTickets = isAdmin || isOrganizer;

  const mapKey = useMemo(() => getEventVenueMapKey(event), [event]);
  const allListings = useMemo(() => getEventListings(event), [event]);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Selected filters & state
  const [ticketQuantity, setTicketQuantity] = useState<number>(2);
  // Modal automatically pops up on initial load unless disabled via query param
  const [showQtyModal, setShowQtyModal] = useState<boolean>(
    searchParams.get("modal") !== "false",
  );
  const [activeZoneId, setActiveZoneId] = useState<string | null>(
    searchParams.get("zone") || null,
  );
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<TicketListing | null>(
    null,
  );
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [showSubtotalModal, setShowSubtotalModal] = useState<boolean>(false);

  // 5-minute Hold countdown & server state (UC04)
  const [holdOrderId, setHoldOrderId] = useState<string | null>(null);
  const [holdExpiresAtMs, setHoldExpiresAtMs] = useState<number | null>(null);
  const [holdTotalAmount, setHoldTotalAmount] = useState<number | null>(null);
  const [holdSecondsLeft, setHoldSecondsLeft] = useState<number | null>(null);
  const [holdOrderCode, setHoldOrderCode] = useState<string | null>(null);
  const [allocatedSeats, setAllocatedSeats] = useState<
    Array<{
      id: string;
      zoneName: string;
      rowLabel: string;
      seatNumber: string;
    }>
  >([]);
  const [isHoldingTicket, setIsHoldingTicket] = useState<boolean>(false);
  const [holdErrorMessage, setHoldErrorMessage] = useState<string | null>(null);

  // Countdown bám theo holdExpiresAt của server (không tự đếm lùi theo client).
  // Hết hạn: đóng drawer + popup tạm tính, vô hiệu thanh toán (UC04-E2).
  useEffect(() => {
    if (holdExpiresAtMs === null) return;
    const timer = setInterval(() => {
      const left = computeRemainingSeconds(holdExpiresAtMs, Date.now());
      if (left > 0) {
        setHoldSecondsLeft(left);
        return;
      }
      clearInterval(timer);
      setShowSubtotalModal(false);
      setSelectedListing(null);
      setHoldSecondsLeft(null);
      setHoldExpiresAtMs(null);
      setHoldTotalAmount(null);
      setHoldOrderCode(null);
      setHoldOrderId(null);
      setAllocatedSeats([]);
      setHoldErrorMessage(
        "Hết thời gian giữ chỗ 5 phút. Vé đã được trả lại hệ thống, vui lòng chọn lại.",
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [holdExpiresAtMs]);

  // Rời trang/đóng tab khi đang giữ chỗ: cố gắng nhả ghế ngay (UC04-E3).
  // Nếu không gửi kịp, job quét 30 giây/lần sẽ trả ghế sau khi hết hạn (UC04-E2).
  useEffect(() => {
    if (!holdOrderId) return;
    const releaseOnLeave = () => releaseOnPageLeave(holdOrderId);
    window.addEventListener("pagehide", releaseOnLeave);
    return () => window.removeEventListener("pagehide", releaseOnLeave);
  }, [holdOrderId]);

  // Filter listings based on activeZoneId
  const filteredListings = useMemo(
    () => filterListingsByZone(allListings, activeZoneId),
    [allListings, activeZoneId],
  );

  // Thong tin tung khu cho tooltip so do (gia thap nhat, tong ve con lai)
  const zoneInfoMap = useMemo(
    () => buildZoneInfoMap(allListings),
    [allListings],
  );

  const resetHoldState = () => {
    setShowSubtotalModal(false);
    setSelectedListing(null);
    setHoldSecondsLeft(null);
    setHoldExpiresAtMs(null);
    setHoldTotalAmount(null);
    setHoldOrderCode(null);
    setHoldOrderId(null);
    setAllocatedSeats([]);
  };

  const handleStartHold = async (listing: TicketListing) => {
    // 1 phiên giữ chỗ / tài khoản / sự kiện: chặn bấm lặp hoặc giữ thêm khi đang giữ
    if (isHoldingTicket || holdOrderId) return;

    if (listing.availableTickets < ticketQuantity) {
      setHoldErrorMessage(
        insufficientTicketsMessage(
          listing.section,
          listing.availableTickets,
          ticketQuantity,
        ),
      );
      return;
    }

    if (cannotBuyTickets) {
      setSelectedListing(listing);
      return;
    }

    setIsHoldingTicket(true);
    setHoldErrorMessage(null);

    try {
      const outcome = await requestHold({
        eventId: event.id,
        items: [{ ticketTypeId: listing.id, quantity: ticketQuantity }],
      });

      if (outcome.kind === "http-error") {
        const info = getHoldErrorInfo(
          outcome.status,
          outcome.code,
          outcome.message,
        );

        // Tuyệt đối không mở checkout drawer khi API thất bại
        resetHoldState();
        setHoldErrorMessage(info.message);
        if (info.action === "LOGIN") {
          router.push(`/auth?redirect=${encodeURIComponent(pathname)}`);
        }
        return;
      }

      const session = parseHoldSession(outcome.data, nowMs());
      setHoldOrderId(session.orderId);
      setHoldOrderCode(session.orderCode);
      setHoldExpiresAtMs(session.expiresAtMs);
      setHoldSecondsLeft(session.secondsLeft);
      setHoldTotalAmount(session.totalAmount);
      setAllocatedSeats(session.allocatedSeats);
      setSelectedListing(listing);
      setHoldErrorMessage(null);
    } catch (err: unknown) {
      resetHoldState();
      setHoldErrorMessage(
        err instanceof Error
          ? err.message
          : "Đã xảy ra lỗi khi kết nối tới máy chủ giữ chỗ.",
      );
    } finally {
      setIsHoldingTicket(false);
    }
  };

  const handleCancelHold = async () => {
    const currentOrderId = holdOrderId;

    // Đóng drawer ngay để người dùng không thao tác tiếp trên phiên đã hủy
    resetHoldState();
    setHoldErrorMessage(null);

    // Gọi API release hold để giải phóng ghế; báo lỗi thật nếu không nhả được
    if (currentOrderId) {
      try {
        if (!(await requestRelease(currentOrderId))) {
          setHoldErrorMessage(
            "Chưa hủy được giữ chỗ trên máy chủ. Ghế sẽ tự được trả lại sau tối đa 5 phút.",
          );
        }
      } catch {
        setHoldErrorMessage(
          "Mất kết nối khi hủy giữ chỗ. Ghế sẽ tự được trả lại sau tối đa 5 phút.",
        );
      }
    }
  };

  return {
    event,
    user,
    isAdmin,
    isOrganizer,
    cannotBuyTickets,
    mapKey,
    router,
    ticketQuantity,
    setTicketQuantity,
    showQtyModal,
    setShowQtyModal,
    activeZoneId,
    setActiveZoneId,
    hoveredZoneId,
    setHoveredZoneId,
    selectedListing,
    isSaved,
    setIsSaved,
    showSubtotalModal,
    setShowSubtotalModal,
    holdOrderId,
    holdTotalAmount,
    holdSecondsLeft,
    holdOrderCode,
    allocatedSeats,
    holdErrorMessage,
    setHoldErrorMessage,
    filteredListings,
    zoneInfoMap,
    handleStartHold,
    handleCancelHold,
    formatCountdown,
  };
}

export type BookingScreen = ReturnType<typeof useBookingScreen>;
