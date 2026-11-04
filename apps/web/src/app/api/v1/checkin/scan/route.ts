import { NextRequest } from "next/server";
import { verifyAndScanQrToken } from "@/lib/checkin-engine";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { qrToken, gateId, eventId, staffName } = body || {};

    if (!qrToken || !gateId) {
      return Response.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Thiếu nội dung qrToken hoặc mã cổng gateId.",
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: `req_${Date.now().toString(36)}`,
          },
        },
        { status: 400 },
      );
    }

    const result = verifyAndScanQrToken({
      qrToken: String(qrToken),
      gateId: String(gateId),
      eventId: String(eventId || "evt-anh-trai-vuot-ngan-chong-gai"),
      staffName: staffName ? String(staffName) : "Nhân viên Cổng B2",
    });

    const isSuccess = result.status === "VALID";
    return Response.json(
      {
        success: isSuccess,
        data: result,
        ...(isSuccess
          ? {}
          : {
              error: {
                code:
                  result.status === "ALREADY_USED"
                    ? "TICKET_ALREADY_USED"
                    : result.status === "EXPIRED"
                      ? "QR_TOKEN_EXPIRED"
                      : result.reasonCode || "INVALID_TICKET",
                message: result.message,
              },
            }),
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `req_${Date.now().toString(36)}`,
        },
      },
      {
        status: isSuccess ? 200 : result.status === "ALREADY_USED" ? 409 : 422,
      },
    );
  } catch {
    return Response.json(
      {
        success: false,
        error: {
          code: "SCAN_ERROR",
          message: "Không thể xử lý yêu cầu quét vé.",
        },
      },
      { status: 400 },
    );
  }
}
