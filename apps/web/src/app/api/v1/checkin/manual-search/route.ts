import { NextRequest } from "next/server";
import { manualCheckInTicket, manualSearchTickets } from "@/lib/checkin-engine";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, eventId, searchQuery, ticketId, gateId, staffName } =
      body || {};

    if (action === "checkin" && ticketId) {
      const checkInRes = manualCheckInTicket({
        ticketId: String(ticketId),
        eventId: String(eventId || "evt-anh-trai-vuot-ngan-chong-gai"),
        gateId: String(gateId || "GATE-B2"),
        staffName: String(staffName || "Nhân viên Cổng B2"),
      });

      return Response.json({
        success: checkInRes.status === "VALID",
        data: checkInRes,
      });
    }

    const tickets = manualSearchTickets({
      eventId: eventId ? String(eventId) : undefined,
      searchQuery: String(searchQuery || ""),
    });

    return Response.json({
      success: true,
      data: {
        tickets,
        total: tickets.length,
      },
    });
  } catch {
    return Response.json(
      {
        success: false,
        error: {
          code: "MANUAL_SEARCH_ERROR",
          message: "Không thể tra cứu thông tin vé thủ công.",
        },
      },
      { status: 400 },
    );
  }
}
