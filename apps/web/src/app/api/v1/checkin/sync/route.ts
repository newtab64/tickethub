import { NextRequest } from "next/server";
import {
  syncOfflineCheckinQueue,
  type OfflineScanQueueItem,
} from "@/lib/checkin-engine";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const queue = Array.isArray(body?.queue)
      ? (body.queue as OfflineScanQueueItem[])
      : [];

    const results = syncOfflineCheckinQueue(queue);
    const conflictCount = results.filter(
      (r) => r.syncStatus === "CONFLICT",
    ).length;
    const syncedCount = results.filter((r) => r.syncStatus === "SYNCED").length;

    return Response.json({
      success: true,
      data: {
        syncedCount,
        conflictCount,
        results,
      },
    });
  } catch {
    return Response.json(
      {
        success: false,
        error: {
          code: "SYNC_ERROR",
          message: "Lỗi đồng bộ hàng đợi check-in ngoại tuyến.",
        },
      },
      { status: 400 },
    );
  }
}
