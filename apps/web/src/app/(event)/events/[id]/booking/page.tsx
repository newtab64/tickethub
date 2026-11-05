"use client";
import { Suspense, use } from "react";
import { LiveEvent } from "@/components/events/live-event";
export default function BookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <Suspense fallback={<p>Đang tải...</p>}>
      <LiveEvent key={id} identifier={id} booking />
    </Suspense>
  );
}
