import { NextRequest } from "next/server";
import {
  getGateTicketsForEvent,
  issueDynamicQrToken,
} from "@/lib/checkin-engine";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const searchParams = request.nextUrl.searchParams;

  const existing = getGateTicketsForEvent().find(
    (t) => t.id === id || t.ticketCode === id,
  );

  // UC05-E7: Reject issuing Dynamic QR for CANCELLED or CHECKED_IN tickets
  if (
    existing &&
    (existing.status === "CANCELLED" || existing.status === "CHECKED_IN")
  ) {
    return Response.json(
      {
        success: false,
        error: {
          code: "TICKET_NOT_ELIGIBLE_FOR_QR",
          message:
            existing.status === "CANCELLED"
              ? "Vé đã bị hủy và hoàn tiền, không thể cấp mã QR vào cổng."
              : "Vé đã được sử dụng qua cổng kiểm soát, không thể cấp lại mã QR động.",
          details: {
            ticketId: existing.id,
            ticketCode: existing.ticketCode,
            status: existing.status,
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `req_${Date.now().toString(36)}`,
        },
      },
      { status: 422 },
    );
  }

  const ticket = existing || {
    id,
    ticketCode: searchParams.get("ticketCode") || `TKT-VN-${id.slice(-5)}`,
    orderCode: searchParams.get("orderCode") || "ORD-88412",
    eventId: searchParams.get("eventId") || "evt-anh-trai-vuot-ngan-chong-gai",
    zoneName: searchParams.get("zoneName") || "VIP BẠC",
    rowLabel: searchParams.get("rowLabel") || "Hàng 12",
    seatNumbers: searchParams.get("seatNumbers") || "H12-05, H12-06",
  };

  const issued = issueDynamicQrToken(ticket);

  return Response.json({
    success: true,
    data: {
      ticketId: issued.ticketId,
      qrToken: issued.qrToken,
      issuedAt: issued.issuedAt,
      expiresAt: issued.expiresAt,
      ttlSeconds: issued.ttlSeconds,
      refreshIntervalSeconds: issued.refreshIntervalSeconds,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: `req_${Date.now().toString(36)}`,
    },
  });
}
