"use client";

import { Suspense } from "react";
import { notFound, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { PublicEvent } from "@tickethub/shared";
import { EventLoadError, fetchPublicEvent } from "@/features/event";
import { useBookingScreen } from "./use-booking-screen";
import { BookingHeader } from "./booking-header";
import { BookingMapPane } from "./booking-map-pane";
import { BookingListingsPane } from "./booking-listings-pane";
import { QuantityModal } from "./quantity-modal";
import { CheckoutDrawer } from "./checkout-drawer";
import { SubtotalModal } from "./subtotal-modal";

const loading = (
  <div
    role="status"
    className="h-screen flex items-center justify-center text-[13px] text-[#606970]"
  >
    Đang tải sơ đồ sự kiện...
  </div>
);

export function BookingPage() {
  const { id } = useParams<{ id: string }>();
  const query = useQuery({
    queryKey: ["public-event", id],
    queryFn: () => fetchPublicEvent(id),
    retry: false,
    // Ton ve thay doi lien tuc khi nhieu nguoi cung mua.
    refetchInterval: 10_000,
  });

  if (query.data === null) notFound();
  if (!query.data) {
    return query.isError ? (
      <EventLoadError retry={() => void query.refetch()} />
    ) : (
      loading
    );
  }

  return (
    <Suspense fallback={loading}>
      <EventSplitView
        key={query.data.id}
        event={query.data}
        updatedAt={query.dataUpdatedAt}
        refresh={() => void query.refetch()}
      />
    </Suspense>
  );
}

function EventSplitView(props: {
  event: PublicEvent;
  updatedAt: number;
  refresh: () => void;
}) {
  const vm = useBookingScreen(props.event, props.updatedAt, props.refresh);
  const { showQtyModal, selectedListing, showSubtotalModal } = vm;

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden text-[#141d23]">
      <BookingHeader vm={vm} />

      {/* Khong gian lam viec chia doi toan chieu cao */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {vm.mapKey && <BookingMapPane vm={vm} mapKey={vm.mapKey} />}
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
