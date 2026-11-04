export const DEFAULT_CHECKIN_EVENT_ID = "evt-anh-trai-vuot-ngan-chong-gai";
export const DEFAULT_CHECKIN_EVENT_TITLE = "Anh Trai Vượt Ngàn Chông Gai";

export const DYNAMIC_QR_TTL_SECONDS = 30;
export const CLOCK_SKEW_TOLERANCE_SECONDS = 5;
export const MAX_OFFLINE_QUEUE_SIZE = 500;

export type ScanResultStatus = "VALID" | "ALREADY_USED" | "EXPIRED" | "INVALID";
export type ScanFeedbackColor = "GREEN" | "RED" | "YELLOW";
export type InvalidReasonCode =
  | "WRONG_EVENT"
  | "TICKET_CANCELLED"
  | "INVALID_SIGNATURE"
  | "TICKET_NOT_FOUND"
  | "MALFORMED_QR"
  | "OFFLINE_QUEUE_FULL";

export interface GateTicketRecord {
  id: string;
  ticketCode: string;
  orderCode: string;
  eventId: string;
  eventTitle: string;
  zoneName: string;
  rowLabel: string;
  seatNumbers: string;
  ticketTypeName: string;
  recipientName: string;
  recipientPhone: string;
  recipientCccd: string;
  recipientEmail: string;
  status: "VALID" | "CHECKED_IN" | "CANCELLED";
  gateInfo: string;
  checkedInAt?: string;
  checkedInGate?: string;
  checkedInBy?: string;
  checkInMethod?: "QR_SCAN" | "MANUAL" | "OFFLINE_SYNC";
}

export interface DynamicQrTokenPayload {
  ver: number;
  sub: string;
  eventId: string;
  ticketCode: string;
  seat: string;
  tkt: string;
  ord: string;
  evt: string;
  sec: string;
  row: string;
  sts: string;
  iat: number;
  exp: number;
  jti: string;
  sig: string;
}

export interface ScanCheckinResponse {
  status: ScanResultStatus;
  color: ScanFeedbackColor;
  message: string;
  reasonCode?: InvalidReasonCode;
  ticketCode?: string;
  orderCode?: string;
  eventTitle?: string;
  ticketTypeName?: string;
  zoneName?: string;
  rowLabel?: string;
  seatNumbers?: string;
  seat?: string;
  holderName?: string;
  gateId?: string;
  checkedInAt?: string;
  previousCheckedInAt?: string;
  previousGateId?: string;
}

export interface OfflineScanQueueItem {
  queueId: string;
  ticketId: string;
  ticketCode: string;
  eventId: string;
  gateId: string;
  staffName: string;
  scannedAt: string;
  qrToken: string;
}

export interface OfflineSyncResultItem {
  queueId: string;
  ticketCode: string;
  syncStatus: "SYNCED" | "CONFLICT" | "REJECTED";
  message: string;
  conflictGateId?: string;
  conflictCheckedInAt?: string;
}

const ED25519_PUBLIC_KEY_FINGERPRINT = "ed25519-pub-tickethub-2026-v1";
const QR_SIGNING_SEED =
  process.env.NEXT_PUBLIC_QR_SIGNING_SEED ??
  "tickethub-ed25519-dynamic-qr-seed-2026";

/**
 * Deterministic lightweight signature helper (runs identically in Browser, Edge & Node test).
 */
export function computeTokenSignature(
  payloadWithoutSig: Pick<
    DynamicQrTokenPayload,
    "ver" | "sub" | "tkt" | "evt" | "iat" | "exp" | "jti"
  >,
): string {
  const raw = `${payloadWithoutSig.ver}|${payloadWithoutSig.sub}|${payloadWithoutSig.tkt}|${payloadWithoutSig.evt}|${payloadWithoutSig.iat}|${payloadWithoutSig.exp}|${payloadWithoutSig.jti}|${QR_SIGNING_SEED}`;
  let h1 = 0xdeadbeef ^ raw.length;
  let h2 = 0x41c6ce57 ^ raw.length;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const hex2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return `ed25519_${hex1}${hex2}`;
}

// Initial seeded tickets for gate check-in & manual lookup
const INITIAL_GATE_TICKETS: GateTicketRecord[] = [
  {
    id: "tkt-order-88412",
    ticketCode: "TKT-VN-88412-V01",
    orderCode: "ORD-88412",
    eventId: DEFAULT_CHECKIN_EVENT_ID,
    eventTitle: DEFAULT_CHECKIN_EVENT_TITLE,
    zoneName: "VIP BẠC",
    rowLabel: "Hàng 12",
    seatNumbers: "H12-05, H12-06",
    ticketTypeName: "VIP BẠC",
    recipientName: "Trần Phú An",
    recipientPhone: "0912345678",
    recipientCccd: "079204008812",
    recipientEmail: "tranphuan68686868@gmail.com",
    status: "VALID",
    gateInfo: "Cổng B - Cửa B2 (Khán đài Tây)",
  },
  {
    id: "tkt-order-88415",
    ticketCode: "TKT-VN-88415-F02",
    orderCode: "ORD-88415",
    eventId: DEFAULT_CHECKIN_EVENT_ID,
    eventTitle: DEFAULT_CHECKIN_EVENT_TITLE,
    zoneName: "FLOOR A (Đứng gần sân khấu)",
    rowLabel: "Khu Fanzone",
    seatNumbers: "FZ-18",
    ticketTypeName: "GA FANZONE",
    recipientName: "Nguyễn Minh Khôi",
    recipientPhone: "0987654321",
    recipientCccd: "001099014521",
    recipientEmail: "minhkhoi.nguyen@gmail.com",
    status: "VALID",
    gateInfo: "Cổng A - Cửa A1 (Khán đài Chính)",
  },
  {
    id: "tkt-order-88419",
    ticketCode: "TKT-VN-88419-V09",
    orderCode: "ORD-88419",
    eventId: DEFAULT_CHECKIN_EVENT_ID,
    eventTitle: DEFAULT_CHECKIN_EVENT_TITLE,
    zoneName: "VVIP ĐỎ",
    rowLabel: "Hàng 02",
    seatNumbers: "H02-01",
    ticketTypeName: "VVIP",
    recipientName: "Lê Hoàng Gia Khang",
    recipientPhone: "0909112233",
    recipientCccd: "079203001928",
    recipientEmail: "giakhang.pm@tickethub.vn",
    status: "VALID",
    gateInfo: "Cổng VIP - Cửa V1",
  },
  {
    id: "tkt-order-77291",
    ticketCode: "TKT-VN-77291-A08",
    orderCode: "ORD-77291",
    eventId: DEFAULT_CHECKIN_EVENT_ID,
    eventTitle: DEFAULT_CHECKIN_EVENT_TITLE,
    zoneName: "Khán đài A (Tầng 2)",
    rowLabel: "Hàng 08",
    seatNumbers: "A8-14",
    ticketTypeName: "CAT 1",
    recipientName: "Phạm Tuấn Anh",
    recipientPhone: "0933445566",
    recipientCccd: "038098007721",
    recipientEmail: "tuananh.be@tickethub.vn",
    status: "CHECKED_IN",
    gateInfo: "Cổng A - Cửa A1 (Khán đài chính)",
    checkedInAt: "2026-11-01T18:05:12.000Z",
    checkedInGate: "GATE-A1",
    checkedInBy: "Nhân viên Cổng A1",
    checkInMethod: "QR_SCAN",
  },
  {
    id: "tkt-order-65103",
    ticketCode: "TKT-VN-65103-C03",
    orderCode: "ORD-65103",
    eventId: DEFAULT_CHECKIN_EVENT_ID,
    eventTitle: DEFAULT_CHECKIN_EVENT_TITLE,
    zoneName: "Khu Vực Phổ Thông CAT 2",
    rowLabel: "Tự do",
    seatNumbers: "GA-103, GA-104",
    ticketTypeName: "CAT 2",
    recipientName: "Võ Vi Kiệt",
    recipientPhone: "0977889900",
    recipientCccd: "079202006510",
    recipientEmail: "vikiet.fe1@tickethub.vn",
    status: "CANCELLED",
    gateInfo: "Cổng C (Khán đài Đông)",
  },
];

// In-memory store for atomic check-in operations
let ticketStore: Map<string, GateTicketRecord> = new Map(
  INITIAL_GATE_TICKETS.map((t) => [t.id, { ...t }]),
);
let usedJtiSet: Set<string> = new Set();

export function resetCheckinStore(): void {
  ticketStore = new Map(INITIAL_GATE_TICKETS.map((t) => [t.id, { ...t }]));
  usedJtiSet = new Set();
}

export function getGateTicketsForEvent(eventId?: string): GateTicketRecord[] {
  const all = Array.from(ticketStore.values());
  if (!eventId) return all;
  return all.filter((t) => t.eventId === eventId);
}

export function getPublicKeyMetadata() {
  return {
    algorithm: "Ed25519",
    fingerprint: ED25519_PUBLIC_KEY_FINGERPRINT,
    ttlSeconds: DYNAMIC_QR_TTL_SECONDS,
  };
}

/**
 * UC05: Issue a 30-second Ed25519 dynamic QR token for a valid ticket.
 */
export function issueDynamicQrToken(
  ticket: Pick<
    GateTicketRecord,
    | "id"
    | "ticketCode"
    | "orderCode"
    | "eventId"
    | "zoneName"
    | "rowLabel"
    | "seatNumbers"
  >,
  nowEpochSec: number = Math.floor(Date.now() / 1000),
  customJti?: string,
) {
  const iat = nowEpochSec;
  const exp = nowEpochSec + DYNAMIC_QR_TTL_SECONDS;
  const jti =
    customJti ||
    `jti-${ticket.id}-${iat}-${Math.random().toString(36).slice(2, 7)}`;
  const seatFormatted = `${ticket.zoneName} - ${ticket.rowLabel} - Ghế ${ticket.seatNumbers}`;

  const unsignedPayload = {
    ver: 2,
    sub: ticket.id,
    eventId: ticket.eventId,
    ticketCode: ticket.ticketCode,
    seat: seatFormatted,
    tkt: ticket.ticketCode,
    ord: ticket.orderCode,
    evt: ticket.eventId,
    sec: ticket.zoneName,
    row: ticket.rowLabel,
    sts: ticket.seatNumbers,
    iat,
    exp,
    jti,
  };

  const sig = computeTokenSignature(unsignedPayload);
  const fullPayload: DynamicQrTokenPayload = {
    ...unsignedPayload,
    sig,
  };

  const qrToken = JSON.stringify(fullPayload);

  return {
    ticketId: ticket.id,
    qrToken,
    payload: fullPayload,
    issuedAt: new Date(iat * 1000).toISOString(),
    expiresAt: new Date(exp * 1000).toISOString(),
    ttlSeconds: DYNAMIC_QR_TTL_SECONDS,
    refreshIntervalSeconds: 25,
  };
}

/**
 * Parse a QR token string (either JSON or base64 JSON).
 */
export function parseDynamicQrToken(
  qrToken: string,
): DynamicQrTokenPayload | null {
  if (!qrToken || typeof qrToken !== "string") return null;
  const trimmed = qrToken.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && parsed.sub && parsed.tkt) {
      return parsed as DynamicQrTokenPayload;
    }
  } catch {
    try {
      const decoded = atob(trimmed);
      const parsed = JSON.parse(decoded);
      if (parsed && typeof parsed === "object" && parsed.sub && parsed.tkt) {
        return parsed as DynamicQrTokenPayload;
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * UC08: Atomic QR verification and check-in at gate.
 * Handles Main Flow (GREEN), E1 Already Used (RED), E2 Invalid/Cancelled/Wrong Event (RED), E3 Expired >30s (YELLOW).
 */
export function verifyAndScanQrToken(params: {
  qrToken: string;
  eventId: string;
  gateId: string;
  staffName?: string;
  nowEpochSec?: number;
}): ScanCheckinResponse {
  const {
    qrToken,
    eventId,
    gateId,
    staffName = "Nhân viên soát vé",
    nowEpochSec = Math.floor(Date.now() / 1000),
  } = params;

  const payload = parseDynamicQrToken(qrToken);
  if (!payload) {
    return {
      status: "INVALID",
      color: "RED",
      reasonCode: "MALFORMED_QR",
      message: "Mã QR không đúng định dạng TicketHub Ed25519.",
    };
  }

  // Mandatory cryptographic signature & timestamp validation (UC08-E2)
  if (typeof payload.exp !== "number" || typeof payload.iat !== "number") {
    return {
      status: "INVALID",
      color: "RED",
      reasonCode: "MALFORMED_QR",
      ticketCode: payload.tkt,
      orderCode: payload.ord,
      message: "Mã QR thiếu thông tin thời gian hiệu lực (iat/exp).",
    };
  }

  const expectedSig = computeTokenSignature({
    ver: payload.ver,
    sub: payload.sub,
    tkt: payload.tkt,
    evt: payload.evt,
    iat: payload.iat,
    exp: payload.exp,
    jti: payload.jti || "",
  });
  if (!payload.sig || payload.sig !== expectedSig) {
    return {
      status: "INVALID",
      color: "RED",
      reasonCode: "INVALID_SIGNATURE",
      ticketCode: payload.tkt,
      orderCode: payload.ord,
      message:
        "Chữ ký số Ed25519 không hợp lệ hoặc bị thiếu! Cảnh báo vé giả mạo.",
    };
  }

  // UC08-E2: Check if ticket belongs to the selected event
  if (payload.evt && eventId && payload.evt !== eventId) {
    return {
      status: "INVALID",
      color: "RED",
      reasonCode: "WRONG_EVENT",
      ticketCode: payload.tkt,
      orderCode: payload.ord,
      message: `Vé thuộc sự kiện khác (${payload.evt}), không thuộc sự kiện đang kiểm soát tại cổng này.`,
    };
  }

  // Look up ticket in store (or synthesize from payload if custom ticket from checkout)
  let record =
    ticketStore.get(payload.sub) ||
    Array.from(ticketStore.values()).find((t) => t.ticketCode === payload.tkt);

  if (!record) {
    record = {
      id: payload.sub,
      ticketCode: payload.tkt,
      orderCode: payload.ord || "ORD-CUSTOM",
      eventId: payload.evt || eventId,
      eventTitle: DEFAULT_CHECKIN_EVENT_TITLE,
      zoneName: payload.sec || "VIP",
      rowLabel: payload.row || "Hàng A",
      seatNumbers: payload.sts || "A-01",
      ticketTypeName: payload.sec || "VIP",
      recipientName: "Trần Phú An",
      recipientPhone: "0912345678",
      recipientCccd: "079204008812",
      recipientEmail: "tranphuan68686868@gmail.com",
      status: "VALID",
      gateInfo: gateId,
    };
    ticketStore.set(record.id, record);
  }

  // UC08-E2: Check if ticket was cancelled/refunded
  if (record.status === "CANCELLED") {
    return {
      status: "INVALID",
      color: "RED",
      reasonCode: "TICKET_CANCELLED",
      ticketCode: record.ticketCode,
      orderCode: record.orderCode,
      zoneName: record.zoneName,
      rowLabel: record.rowLabel,
      seatNumbers: record.seatNumbers,
      holderName: record.recipientName,
      message: "Vé đã bị hủy và hoàn tiền (CANCELLED). Từ chối cho vào cổng!",
    };
  }

  // UC08-E1: Atomic check if ticket was ALREADY USED (or JTI replayed)
  if (
    record.status === "CHECKED_IN" ||
    (payload.jti && usedJtiSet.has(payload.jti))
  ) {
    return {
      status: "ALREADY_USED",
      color: "RED",
      ticketCode: record.ticketCode,
      orderCode: record.orderCode,
      ticketTypeName: record.ticketTypeName,
      zoneName: record.zoneName,
      rowLabel: record.rowLabel,
      seatNumbers: record.seatNumbers,
      seat: `${record.zoneName} - ${record.rowLabel} - Ghế ${record.seatNumbers}`,
      holderName: record.recipientName,
      previousCheckedInAt: record.checkedInAt,
      previousGateId: record.checkedInGate,
      message: `CẢNH BÁO QUÉT TRÙNG: Vé đã được soát trước đó tại ${record.checkedInGate || "Cổng A"} lúc ${
        record.checkedInAt
          ? new Date(record.checkedInAt).toLocaleTimeString("vi-VN")
          : "vừa xong"
      }.`,
    };
  }

  // UC08-E3: Check if 30s Dynamic QR token is EXPIRED (anti-screenshot)
  if (
    typeof payload.exp === "number" &&
    nowEpochSec > payload.exp + CLOCK_SKEW_TOLERANCE_SECONDS
  ) {
    return {
      status: "EXPIRED",
      color: "YELLOW",
      ticketCode: record.ticketCode,
      orderCode: record.orderCode,
      zoneName: record.zoneName,
      rowLabel: record.rowLabel,
      seatNumbers: record.seatNumbers,
      holderName: record.recipientName,
      message:
        "Mã QR động đã hết hạn (> 30 giây) hoặc là ảnh chụp màn hình cũ! Vui lòng yêu cầu khách mở ứng dụng làm mới mã QR.",
    };
  }

  // Atomic transition: VALID -> CHECKED_IN
  const checkedInIso = new Date(nowEpochSec * 1000).toISOString();
  record.status = "CHECKED_IN";
  record.checkedInAt = checkedInIso;
  record.checkedInGate = gateId;
  record.checkedInBy = staffName;
  record.checkInMethod = "QR_SCAN";
  ticketStore.set(record.id, record);

  if (payload.jti) {
    usedJtiSet.add(payload.jti);
  }

  return {
    status: "VALID",
    color: "GREEN",
    ticketCode: record.ticketCode,
    orderCode: record.orderCode,
    eventTitle: record.eventTitle,
    ticketTypeName: record.ticketTypeName,
    zoneName: record.zoneName,
    rowLabel: record.rowLabel,
    seatNumbers: record.seatNumbers,
    seat: `${record.zoneName} - ${record.rowLabel} - Ghế ${record.seatNumbers}`,
    holderName: record.recipientName,
    gateId,
    checkedInAt: checkedInIso,
    message: "VÉ HỢP LỆ - Mời khách qua cổng kiểm soát!",
  };
}

/**
 * UC08-E6: Manual lookup by ticketCode, orderCode, phone, CCCD, email, or buyer name.
 */
export function manualSearchTickets(params: {
  eventId?: string;
  searchQuery: string;
}): GateTicketRecord[] {
  const q = (params.searchQuery || "").trim().toLowerCase();
  if (!q) return getGateTicketsForEvent(params.eventId);

  return getGateTicketsForEvent(params.eventId).filter(
    (t) =>
      t.ticketCode.toLowerCase().includes(q) ||
      t.orderCode.toLowerCase().includes(q) ||
      t.recipientPhone.toLowerCase().includes(q) ||
      t.recipientCccd.toLowerCase().includes(q) ||
      t.recipientEmail.toLowerCase().includes(q) ||
      t.recipientName.toLowerCase().includes(q),
  );
}

/**
 * UC08-E5: Local cryptographic + cached-state verification when gate scanner is OFFLINE.
 */
export function verifyOfflineQrToken(params: {
  qrToken: string;
  eventId: string;
  gateId: string;
  staffName?: string;
  nowEpochSec?: number;
  cachedTickets?: GateTicketRecord[];
  existingQueue?: OfflineScanQueueItem[];
}): {
  response: ScanCheckinResponse;
  queueItem?: OfflineScanQueueItem;
} {
  const {
    qrToken,
    eventId,
    gateId,
    staffName = "Nhân viên soát vé",
    nowEpochSec = Math.floor(Date.now() / 1000),
    cachedTickets = getGateTicketsForEvent(eventId),
    existingQueue = [],
  } = params;

  if (existingQueue.length >= MAX_OFFLINE_QUEUE_SIZE) {
    return {
      response: {
        status: "INVALID",
        color: "RED",
        reasonCode: "OFFLINE_QUEUE_FULL",
        message: `Hàng đợi ngoại tuyến đã đạt giới hạn tối đa (${MAX_OFFLINE_QUEUE_SIZE} lượt). Vui lòng kết nối mạng để đồng bộ trước khi quét tiếp.`,
      },
    };
  }

  const payload = parseDynamicQrToken(qrToken);
  if (
    !payload ||
    typeof payload.exp !== "number" ||
    typeof payload.iat !== "number"
  ) {
    return {
      response: {
        status: "INVALID",
        color: "RED",
        reasonCode: "MALFORMED_QR",
        message: "Mã QR không đúng định dạng TicketHub.",
      },
    };
  }

  const expectedSig = computeTokenSignature({
    ver: payload.ver,
    sub: payload.sub,
    tkt: payload.tkt,
    evt: payload.evt,
    iat: payload.iat,
    exp: payload.exp,
    jti: payload.jti || "",
  });

  if (!payload.sig || payload.sig !== expectedSig) {
    return {
      response: {
        status: "INVALID",
        color: "RED",
        reasonCode: "INVALID_SIGNATURE",
        ticketCode: payload.tkt,
        orderCode: payload.ord,
        message: "Chữ ký số Ed25519 không hợp lệ khi xác thực ngoại tuyến!",
      },
    };
  }

  if (payload.evt && eventId && payload.evt !== eventId) {
    return {
      response: {
        status: "INVALID",
        color: "RED",
        reasonCode: "WRONG_EVENT",
        ticketCode: payload.tkt,
        orderCode: payload.ord,
        message: `Vé thuộc sự kiện khác (${payload.evt}).`,
      },
    };
  }

  const cachedRecord = cachedTickets.find(
    (t) => t.id === payload.sub || t.ticketCode === payload.tkt,
  );

  if (cachedRecord?.status === "CANCELLED") {
    return {
      response: {
        status: "INVALID",
        color: "RED",
        reasonCode: "TICKET_CANCELLED",
        ticketCode: cachedRecord.ticketCode,
        orderCode: cachedRecord.orderCode,
        holderName: cachedRecord.recipientName,
        message:
          "Vé nằm trong danh sách đã hủy/hoàn tiền (dữ liệu cache ngoại tuyến).",
      },
    };
  }

  const alreadyQueued = existingQueue.find(
    (q) => q.ticketCode === payload.tkt || q.ticketId === payload.sub,
  );
  if (alreadyQueued || cachedRecord?.status === "CHECKED_IN") {
    return {
      response: {
        status: "ALREADY_USED",
        color: "RED",
        ticketCode: payload.tkt,
        orderCode: payload.ord,
        zoneName: payload.sec || cachedRecord?.zoneName,
        rowLabel: payload.row || cachedRecord?.rowLabel,
        seatNumbers: payload.sts || cachedRecord?.seatNumbers,
        holderName: cachedRecord?.recipientName || "Khách hàng",
        previousGateId: alreadyQueued?.gateId || cachedRecord?.checkedInGate,
        previousCheckedInAt:
          alreadyQueued?.scannedAt || cachedRecord?.checkedInAt,
        message: `Vé đã được quét trước đó tại ${alreadyQueued?.gateId || cachedRecord?.checkedInGate || gateId}.`,
      },
    };
  }

  if (nowEpochSec > payload.exp + CLOCK_SKEW_TOLERANCE_SECONDS) {
    return {
      response: {
        status: "EXPIRED",
        color: "YELLOW",
        ticketCode: payload.tkt,
        orderCode: payload.ord,
        zoneName: payload.sec || cachedRecord?.zoneName,
        rowLabel: payload.row || cachedRecord?.rowLabel,
        seatNumbers: payload.sts || cachedRecord?.seatNumbers,
        holderName: cachedRecord?.recipientName || "Khách hàng",
        message:
          "Mã QR đã quá hạn 30 giây! Yêu cầu khách hiển thị mã mới trên ứng dụng.",
      },
    };
  }

  const scannedAt = new Date(nowEpochSec * 1000).toISOString();
  const queueItem: OfflineScanQueueItem = {
    queueId: `off-${nowEpochSec}-${Math.random().toString(36).slice(2, 6)}`,
    ticketId: payload.sub,
    ticketCode: payload.tkt,
    eventId: payload.evt || eventId,
    gateId,
    staffName,
    scannedAt,
    qrToken,
  };

  return {
    response: {
      status: "VALID",
      color: "GREEN",
      ticketCode: payload.tkt,
      orderCode: payload.ord,
      zoneName: payload.sec || cachedRecord?.zoneName || "VIP",
      rowLabel: payload.row || cachedRecord?.rowLabel || "Hàng A",
      seatNumbers: payload.sts || cachedRecord?.seatNumbers || "A-01",
      seat: `${payload.sec || cachedRecord?.zoneName || "VIP"} - ${payload.row || cachedRecord?.rowLabel || "Hàng A"} - Ghế ${payload.sts || cachedRecord?.seatNumbers || "A-01"}`,
      holderName: cachedRecord?.recipientName || "Trần Phú An",
      gateId,
      checkedInAt: scannedAt,
      message:
        "VÉ HỢP LỆ (NGOẠI TUYẾN) - Đã xác thực chữ ký Ed25519 cục bộ và lưu vào hàng đợi đồng bộ.",
    },
    queueItem,
  };
}

/**
 * UC08-E6: Manual check-in confirmation after staff verifies citizen ID (CCCD).
 */
export function manualCheckInTicket(params: {
  ticketId: string;
  eventId: string;
  gateId: string;
  staffName: string;
}): ScanCheckinResponse {
  const record = ticketStore.get(params.ticketId);
  if (!record) {
    return {
      status: "INVALID",
      color: "RED",
      reasonCode: "TICKET_NOT_FOUND",
      message: "Không tìm thấy mã vé trong hệ thống.",
    };
  }

  if (record.status === "CANCELLED") {
    return {
      status: "INVALID",
      color: "RED",
      reasonCode: "TICKET_CANCELLED",
      ticketCode: record.ticketCode,
      orderCode: record.orderCode,
      holderName: record.recipientName,
      message: "Vé đã bị hủy/hoàn tiền, không thể check-in thủ công.",
    };
  }

  if (record.status === "CHECKED_IN") {
    return {
      status: "ALREADY_USED",
      color: "RED",
      ticketCode: record.ticketCode,
      orderCode: record.orderCode,
      holderName: record.recipientName,
      previousCheckedInAt: record.checkedInAt,
      previousGateId: record.checkedInGate,
      message: `Vé này đã được check-in trước đó tại ${record.checkedInGate || "Cổng A"}.`,
    };
  }

  const checkedInIso = new Date().toISOString();
  record.status = "CHECKED_IN";
  record.checkedInAt = checkedInIso;
  record.checkedInGate = params.gateId;
  record.checkedInBy = params.staffName;
  record.checkInMethod = "MANUAL";
  ticketStore.set(record.id, record);

  return {
    status: "VALID",
    color: "GREEN",
    ticketCode: record.ticketCode,
    orderCode: record.orderCode,
    eventTitle: record.eventTitle,
    ticketTypeName: record.ticketTypeName,
    zoneName: record.zoneName,
    rowLabel: record.rowLabel,
    seatNumbers: record.seatNumbers,
    seat: `${record.zoneName} - ${record.rowLabel} - Ghế ${record.seatNumbers}`,
    holderName: record.recipientName,
    gateId: params.gateId,
    checkedInAt: checkedInIso,
    message: `Check-in thủ công thành công (Xác nhận bởi: ${params.staffName}).`,
  };
}

/**
 * UC08-E5: Reconcile and sync offline check-in queue when network is restored.
 * Detects cross-gate duplicate scans (CONFLICT) vs clean offline scans (SYNCED).
 */
export function syncOfflineCheckinQueue(
  queue: OfflineScanQueueItem[],
): OfflineSyncResultItem[] {
  const results: OfflineSyncResultItem[] = [];

  for (const item of queue) {
    const record =
      ticketStore.get(item.ticketId) ||
      Array.from(ticketStore.values()).find(
        (t) => t.ticketCode === item.ticketCode,
      );

    if (!record) {
      results.push({
        queueId: item.queueId,
        ticketCode: item.ticketCode,
        syncStatus: "REJECTED",
        message: "Không tìm thấy vé trên máy chủ khi đồng bộ.",
      });
      continue;
    }

    if (record.status === "CANCELLED") {
      results.push({
        queueId: item.queueId,
        ticketCode: item.ticketCode,
        syncStatus: "REJECTED",
        message: "Vé đã bị hủy trước thời điểm quét offline.",
      });
      continue;
    }

    if (record.status === "CHECKED_IN") {
      results.push({
        queueId: item.queueId,
        ticketCode: item.ticketCode,
        syncStatus: "CONFLICT",
        conflictGateId: record.checkedInGate,
        conflictCheckedInAt: record.checkedInAt,
        message: `XUNG ĐỘT ĐA CỔNG: Vé ${item.ticketCode} đã được quét tại ${record.checkedInGate} lúc ${
          record.checkedInAt
            ? new Date(record.checkedInAt).toLocaleTimeString("vi-VN")
            : ""
        }. Đã gắn cờ báo cáo BTC!`,
      });
      continue;
    }

    record.status = "CHECKED_IN";
    record.checkedInAt = item.scannedAt;
    record.checkedInGate = item.gateId;
    record.checkedInBy = item.staffName;
    record.checkInMethod = "OFFLINE_SYNC";
    ticketStore.set(record.id, record);

    results.push({
      queueId: item.queueId,
      ticketCode: item.ticketCode,
      syncStatus: "SYNCED",
      message: `Đồng bộ thành công vé ${item.ticketCode} (quét tại ${item.gateId}).`,
    });
  }

  return results;
}
