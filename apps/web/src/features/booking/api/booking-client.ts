import { getAccessToken } from "@/shared/api/client";
import type { HoldResponseData } from "../domain/booking-rules";

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export type HoldOutcome =
  | { kind: "ok"; data: HoldResponseData }
  | {
      kind: "http-error";
      status: number;
      code: string | undefined;
      message: string | undefined;
    };

/**
 * Giu cho qua proxy /api/v1/booking/hold. Loi HTTP duoc tra ve co cau truc;
 * phan hoi thanh cong khong hop le hoac loi mang se nem Error.
 */
export async function requestHold(payload: {
  eventId: string;
  items: Array<{ ticketTypeId: string; quantity: number }>;
}): Promise<HoldOutcome> {
  const response = await fetch("/api/v1/booking/hold", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let code: string | undefined;
    let message: string | undefined;
    try {
      const errData = await response.json();
      code = errData?.error?.code;
      message = errData?.error?.message;
    } catch {
      // Body khong phai JSON: dung thong diep theo ma HTTP
    }
    return { kind: "http-error", status: response.status, code, message };
  }

  const json = await response.json();
  const data = json?.success ? json.data : null;
  if (!data?.orderId || !data?.orderCode) {
    throw new Error(
      json?.error?.message || "Không thể khởi tạo phiên giữ chỗ vé.",
    );
  }
  return { kind: "ok", data };
}

/** Huy giu cho; tra ve false neu may chu tu choi, nem loi khi mat ket noi. */
export async function requestRelease(orderId: string): Promise<boolean> {
  const res = await fetch("/api/v1/booking/release", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ orderId }),
  });
  return res.ok;
}

/** Nha ghe ngay khi roi trang (keepalive); khong cho ket qua va bo qua loi. */
export function releaseOnPageLeave(orderId: string): void {
  void fetch("/api/v1/booking/release", {
    method: "POST",
    keepalive: true,
    headers: authHeaders(),
    body: JSON.stringify({ orderId }),
  }).catch(() => undefined);
}
