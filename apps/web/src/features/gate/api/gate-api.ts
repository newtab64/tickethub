import type {
  GateLookupRequest,
  GateScanRequest,
  GateScanResponse,
} from "@tickethub/shared";
import { apiClient, ApiError } from "@/shared/api/client";
import {
  classifyScanVerdict,
  verdictHeadline,
  type ScanFeedbackState,
} from "../domain/gate-rules";

function mapResponseToFeedback(
  res: GateScanResponse,
  latencyMs: number,
  fallbackTicketCode?: string,
): ScanFeedbackState {
  const verdict = classifyScanVerdict(res.status);
  return {
    verdict,
    headline: verdictHeadline(verdict),
    detail: `${res.eventTitle} - ${res.ticketTypeName}`,
    ticketCode: res.ticketCode || fallbackTicketCode,
    buyerName: res.buyerName,
    zoneName: res.zoneName || res.ticketTypeName,
    seatLabel: res.seatLabel,
    checkedInAt: res.checkedInAt || undefined,
    latencyMs,
  };
}

function mapErrorToFeedback(
  err: unknown,
  latencyMs: number,
  fallbackTicketCode?: string,
): ScanFeedbackState {
  if (err instanceof ApiError) {
    const verdict = classifyScanVerdict(undefined, err.code);
    return {
      verdict,
      headline: verdictHeadline(verdict),
      detail: err.message || "Không thể xác thực vé tại cổng.",
      ticketCode: fallbackTicketCode,
      latencyMs,
    };
  }
  return {
    verdict: "INVALID",
    headline: "Không thể kết nối máy chủ soát vé",
    detail: "Kiểm tra lại đường truyền mạng rồi thử quét lại.",
    ticketCode: fallbackTicketCode,
    latencyMs,
  };
}

export async function scanGateTicket(
  payload: GateScanRequest,
  fallbackTicketCode?: string,
): Promise<ScanFeedbackState> {
  const startedAt = performance.now();
  try {
    const res = await apiClient<GateScanResponse>("/gate/scan", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return mapResponseToFeedback(
      res,
      Math.round(performance.now() - startedAt),
      fallbackTicketCode,
    );
  } catch (err) {
    return mapErrorToFeedback(
      err,
      Math.round(performance.now() - startedAt),
      fallbackTicketCode,
    );
  }
}

export async function lookupGateTicket(
  payload: GateLookupRequest,
): Promise<ScanFeedbackState> {
  const startedAt = performance.now();
  try {
    const res = await apiClient<GateScanResponse>("/gate/lookup", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return mapResponseToFeedback(
      res,
      Math.round(performance.now() - startedAt),
      payload.ticketCode,
    );
  } catch (err) {
    return mapErrorToFeedback(
      err,
      Math.round(performance.now() - startedAt),
      payload.ticketCode,
    );
  }
}
