import { NextRequest } from "next/server";
import { EVENTS, getEventById, getEventListings } from "@/lib/events-catalog";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: eventId } = await context.params;

  const event = getEventById(eventId) ?? EVENTS[0];
  const listings = getEventListings(event);

  const totalSeats = listings.reduce((acc, l) => acc + l.availableTickets, 0);

  return Response.json({
    success: true,
    data: {
      eventId: event.id,
      totalAvailable: totalSeats,
      zones: listings.map((l) => ({
        zoneId: l.zoneId,
        zoneName: l.zoneName,
        available: l.availableTickets,
        price: l.price,
      })),
      timestamp: new Date().toISOString(),
    },
  });
}
