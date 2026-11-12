"use client";

import { useMemo, Suspense } from "react";
import { useParams } from "next/navigation";
import { EVENTS, getEventById, type EventItem } from "@/features/event";
import { useBookingScreen } from "./use-booking-screen";
import { BookingHeader } from "./booking-header";
import { BookingUrgencyStrip } from "./booking-urgency-strip";
import { BookingMapPane } from "./booking-map-pane";
import { BookingListingsPane } from "./booking-listings-pane";
import { QuantityModal } from "./quantity-modal";
import { CheckoutDrawer } from "./checkout-drawer";
import { SubtotalModal } from "./subtotal-modal";

export function BookingPage() {
  const params = useParams<{ id: string }>();
  const eventId = typeof params?.id === "string" ? params.id : "";

  const event = useMemo(() => {
    return getEventById(eventId) ?? EVENTS[0];
  }, [eventId]);

  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center text-[13px] text-[#606970]">
          Đang tải sơ đồ sự kiện...
        </div>
      }
    >
      <EventSplitView key={event.id} event={event} />
    </Suspense>
  );
}

function EventSplitView({ event }: { event: EventItem }) {
  const vm = useBookingScreen(event);
  const { showQtyModal, selectedListing, showSubtotalModal } = vm;

  return (
    <div className="flex flex-col h-[calc(100vh-32px)] bg-white overflow-hidden text-[#141d23]">
      <BookingHeader vm={vm} />
      <BookingUrgencyStrip />

      {/* Khong gian lam viec chia doi toan chieu cao */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        <BookingMapPane vm={vm} />
        <BookingListingsPane vm={vm} />
      </div>

      {showQtyModal && <QuantityModal vm={vm} />}
      {selectedListing && (
        <CheckoutDrawer vm={vm} selectedListing={selectedListing} />
      )}
      {showSubtotalModal && selectedListing && (
        <SubtotalModal vm={vm} selectedListing={selectedListing} />
      )}
    </div>
  );
}
