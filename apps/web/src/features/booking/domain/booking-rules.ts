/**
 * Validates ticket quantity according to UC04 specs (1 to 6 tickets per order)
 */
export function isValidTicketQuantity(qty: number): boolean {
  return Number.isInteger(qty) && qty >= 1 && qty <= 6;
}

/**
 * Evaluates whether a zone has enough tickets for the required quantity
 */
export function isZoneAvailable(
  zoneInfo?: { count: number } | null,
  requiredQty = 1,
): boolean {
  if (!zoneInfo) return false;
  return zoneInfo.count >= requiredQty;
}

/**
 * Calculates subtotal for ticket checkout order (W03-FE2)
 */
export function calculateOrderSubtotal(
  unitPrice: number,
  quantity: number,
): number {
  if (
    !Number.isFinite(unitPrice) ||
    !Number.isFinite(quantity) ||
    unitPrice <= 0 ||
    quantity <= 0
  ) {
    return 0;
  }
  return Math.round(unitPrice * quantity);
}

/** Đồng hồ hệ thống tách riêng để component không gọi Date.now trực tiếp (React purity). */
export function nowMs(): number {
  return Date.now();
}

/**
 * Giây còn lại của phiên giữ chỗ, tính theo holdExpiresAt của server (UC04-E2).
 * Làm tròn lên để đồng hồ không về 0 sớm; không bao giờ âm.
 */
export function computeRemainingSeconds(
  expiresAtMs: number,
  nowMs: number,
): number {
  if (!Number.isFinite(expiresAtMs) || !Number.isFinite(nowMs)) return 0;
  return Math.max(0, Math.ceil((expiresAtMs - nowMs) / 1000));
}

export interface HoldErrorInfo {
  message: string;
  action: "LOGIN" | "REFRESH" | "RETRY" | "NONE";
}

/**
 * Ánh xạ lỗi API giữ chỗ theo mã HTTP/mã lỗi sang thông điệp + hành động (UC04-E1, E5, E6, E7).
 */
export function getHoldErrorInfo(
  status: number,
  code?: string,
  serverMessage?: string,
): HoldErrorInfo {
  switch (status) {
    case 401:
      return {
        message:
          "Vui lòng đăng nhập tài khoản Người mua (Buyer) để giữ chỗ và thanh toán vé.",
        action: "LOGIN",
      };
    case 403:
      return {
        message:
          serverMessage ??
          "Tài khoản của bạn không có quyền thực hiện thao tác này.",
        action: "NONE",
      };
    case 404:
      return {
        message: serverMessage ?? "Không tìm thấy sự kiện hoặc hạng vé.",
        action: "REFRESH",
      };
    case 409:
      return {
        message:
          "Vé hoặc ghế vừa được người khác giữ hoặc mua. Vui lòng chọn lại.",
        action: "REFRESH",
      };
    case 422:
      return {
        message:
          serverMessage ??
          "Yêu cầu vi phạm quy định đặt vé (tối đa 6 vé/đơn, mỗi sự kiện 1 phiên giữ chỗ).",
        action: "NONE",
      };
    case 429:
      return {
        message: "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít giây.",
        action: "RETRY",
      };
    case 503:
      return {
        message: "Hệ thống đang bận, vui lòng thử lại sau.",
        action: "RETRY",
      };
    default:
      return {
        message:
          serverMessage ??
          "Không thể thực hiện giữ chỗ vé lúc này. Vui lòng thử lại sau.",
        action: "NONE",
      };
  }
}

/** Dinh dang so giay con lai thanh MM:SS cho dong ho giu cho. */
export function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export interface AllocatedSeatView {
  id: string;
  zoneName: string;
  rowLabel: string;
  seatNumber: string;
}

export interface HoldSession {
  orderId: string;
  orderCode: string;
  expiresAtMs: number;
  secondsLeft: number;
  totalAmount: number | null;
  allocatedSeats: AllocatedSeatView[];
}

/** Du lieu phan hoi giu cho tu backend (cac truong co the thieu). */
export interface HoldResponseData {
  orderId?: string;
  orderCode?: string;
  holdExpiresAt?: string;
  remainingSeconds?: number | string;
  totalAmount?: unknown;
  allocatedSeats?: AllocatedSeatView[];
}

/**
 * Doi phan hoi giu cho thanh phien giu cho: han giu bam theo holdExpiresAt cua server;
 * neu thieu thi dung remainingSeconds. Nem loi khi phien da het han ngay luc khoi tao.
 */
export function parseHoldSession(
  data: HoldResponseData,
  now: number,
): HoldSession {
  const expiresMs = data.holdExpiresAt
    ? Date.parse(data.holdExpiresAt)
    : Number.NaN;
  const remaining = Number.isFinite(expiresMs)
    ? computeRemainingSeconds(expiresMs, now)
    : Number(data.remainingSeconds) || 0;
  if (remaining <= 0) {
    throw new Error("Phiên giữ chỗ đã hết hạn ngay khi khởi tạo.");
  }
  return {
    orderId: data.orderId as string,
    orderCode: data.orderCode as string,
    expiresAtMs: Number.isFinite(expiresMs)
      ? expiresMs
      : now + remaining * 1000,
    secondsLeft: remaining,
    totalAmount: typeof data.totalAmount === "number" ? data.totalAmount : null,
    allocatedSeats: data.allocatedSeats || [],
  };
}

/** Thong bao khi hang ve khong con du so luong yeu cau. */
export function insufficientTicketsMessage(
  section: string,
  available: number,
  requested: number,
): string {
  return `Hạng vé ${section} chỉ còn ${available} vé, không đủ cho yêu cầu ${requested} vé của bạn. Vui lòng giảm số lượng vé hoặc chọn hạng vé khác.`;
}
