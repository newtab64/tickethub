import { NextRequest } from "next/server";
import {
  subscribeSeatStatus,
  broadcastSeatStatus,
  SseSeatEvent,
} from "@/lib/sse-bus";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: eventId } = await context.params;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send initial connection heartbeat
      controller.enqueue(
        encoder.encode(
          `: connected to ticket-hub seat stream for event ${eventId}\n\n`,
        ),
      );

      // 2. Initial state event
      const initialPayload = JSON.stringify({
        seatIds: [],
        status: "AVAILABLE",
        expiresAt: new Date(Date.now() + 300000).toISOString(),
      });
      controller.enqueue(
        encoder.encode(
          `event: seat_status_changed\ndata: ${initialPayload}\n\n`,
        ),
      );

      // 3. Keep-alive ping every 15s to prevent proxy timeouts
      const keepAliveTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(keepAliveTimer);
        }
      }, 15000);

      // 4. Subscribe to broadcast events from other browsers/clients
      const unsubscribe = subscribeSeatStatus(eventId, (eventData) => {
        try {
          const payload = JSON.stringify(eventData);
          controller.enqueue(
            encoder.encode(`event: seat_status_changed\ndata: ${payload}\n\n`),
          );
        } catch {
          // Client disconnected
        }
      });

      // Cleanup when connection closes
      request.signal.addEventListener("abort", () => {
        clearInterval(keepAliveTimer);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// POST endpoint to trigger seat status change (useful for holding/releasing and testing across 2 browsers)
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: eventId } = await context.params;

  try {
    const body = (await request.json()) as SseSeatEvent;

    if (!body?.seatIds || !body?.status) {
      return Response.json(
        { success: false, error: { message: "Invalid payload" } },
        { status: 400 },
      );
    }

    broadcastSeatStatus(eventId, body);

    return Response.json({
      success: true,
      data: {
        eventId,
        broadcasted: body,
      },
    });
  } catch {
    return Response.json(
      { success: false, error: { message: "Failed to parse body" } },
      { status: 400 },
    );
  }
}
