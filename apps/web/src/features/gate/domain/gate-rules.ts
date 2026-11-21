export type ScanVerdict = "VALID" | "DUPLICATE" | "EXPIRED" | "INVALID";

export interface GateOption {
  id: string;
  label: string;
  zoneHint: string;
}

export interface ScanFeedbackState {
  verdict: ScanVerdict;
  headline: string;
  detail: string;
  ticketCode?: string;
  buyerName?: string;
  zoneName?: string;
  seatLabel?: string;
  checkedInAt?: string;
  latencyMs?: number;
}

export interface ScanHistoryEntry extends ScanFeedbackState {
  id: string;
  scannedAt: string;
  mode: "QR" | "MANUAL";
}

export const GATE_OPTIONS: GateOption[] = [
  {
    id: "11111111-1111-4111-8111-111111111101",
    label: "Cổng A - Khu VIP & Sân chính",
    zoneHint: "CAT 1, CAT 2",
  },
  {
    id: "11111111-1111-4111-8111-111111111102",
    label: "Cổng B - Khán đài Bắc",
    zoneHint: "CAT 3, CAT 4",
  },
  {
    id: "11111111-1111-4111-8111-111111111103",
    label: "Cổng C - Khán đài Nam",
    zoneHint: "CAT 5, Khu đứng",
  },
];

export function extractQrTokenFromInput(rawInput: string): {
  qrToken: string;
  ticketCode?: string;
} {
  const trimmed = rawInput.trim();
  if (!trimmed) return { qrToken: "" };

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as {
        token?: string;
        qrToken?: string;
        ticketCode?: string;
      };
      const qrToken = (parsed.qrToken || parsed.token || "").trim();
      return {
        qrToken: qrToken || trimmed,
        ticketCode: parsed.ticketCode,
      };
    } catch {
      return { qrToken: trimmed };
    }
  }

  return { qrToken: trimmed };
}

export function isValidLast4Digits(value: string): boolean {
  return /^[0-9A-Za-z]{4}$/.test(value.trim());
}

export function classifyScanVerdict(
  status?: string,
  errorCode?: string,
): ScanVerdict {
  const normalized = (status || errorCode || "").toUpperCase();
  if (normalized === "VALID" || normalized === "CHECKED_IN_OK") {
    return "VALID";
  }
  if (
    normalized.includes("ALREADY") ||
    normalized.includes("DUPLICATE") ||
    normalized === "USED"
  ) {
    return "DUPLICATE";
  }
  if (normalized.includes("EXPIRED")) {
    return "EXPIRED";
  }
  return "INVALID";
}

export function verdictHeadline(verdict: ScanVerdict): string {
  if (verdict === "VALID") return "Vé hợp lệ: Mời khách vào cổng";
  if (verdict === "DUPLICATE") return "Cảnh báo: Vé đã được quét trước đó";
  if (verdict === "EXPIRED") return "Mã QR đã hết hạn: Vui lòng làm mới";
  return "Từ chối: Vé không hợp lệ";
}
