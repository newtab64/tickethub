/**
 * Utility functions for SeatMap and Minimap calculations (UC04)
 */

export interface MapRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MinimapViewportParams {
  zoom: number;
  pan: { x: number; y: number };
  minimapWidth: number;
  minimapHeight: number;
  containerWidth: number;
  containerHeight: number;
  svgWidth: number;
  svgHeight: number;
  viewBox: string;
}

export interface MinimapViewportResult {
  scaleRatio: number;
  rectWidth: number;
  rectHeight: number;
  rectX: number;
  rectY: number;
  mapBounds: MapRect;
}

export interface MapPanParams {
  pan: { x: number; y: number };
  zoom: number;
  containerWidth: number;
  containerHeight: number;
  svgWidth: number;
  svgHeight: number;
  viewBox: string;
}

export interface MinimapClickParams extends Omit<MapPanParams, "pan"> {
  clickX: number;
  clickY: number;
  mapBounds: MapRect;
}

/** Fit the SVG viewBox into a box using the browser's xMidYMid meet behavior. */
export function fitMapRect(
  boxWidth: number,
  boxHeight: number,
  viewBox: string,
): MapRect {
  const parsed = parseViewBox(viewBox);
  if (
    !Number.isFinite(boxWidth) ||
    !Number.isFinite(boxHeight) ||
    boxWidth <= 0 ||
    boxHeight <= 0 ||
    parsed.width <= 0 ||
    parsed.height <= 0
  ) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const scale = Math.min(boxWidth / parsed.width, boxHeight / parsed.height);
  const width = parsed.width * scale;
  const height = parsed.height * scale;
  return {
    x: (boxWidth - width) / 2,
    y: (boxHeight - height) / 2,
    width,
    height,
  };
}

/** Keep the transformed map within the visible canvas instead of exposing blank space. */
export function clampPanToMap({
  pan,
  zoom,
  containerWidth,
  containerHeight,
  svgWidth,
  svgHeight,
  viewBox,
}: MapPanParams): { x: number; y: number } {
  const canvasMap = fitMapRect(svgWidth, svgHeight, viewBox);
  if (!canvasMap.width || !canvasMap.height) return pan;

  const safeZoom = Math.max(0.1, Number.isFinite(zoom) ? zoom : 1);
  const maxX = Math.max(0, (canvasMap.width * safeZoom - containerWidth) / 2);
  const maxY = Math.max(0, (canvasMap.height * safeZoom - containerHeight) / 2);
  const clampAxis = (value: number, max: number) => {
    const clamped = Math.min(max, Math.max(-max, value));
    return Object.is(clamped, -0) ? 0 : clamped;
  };
  return {
    x: clampAxis(pan.x, maxX),
    y: clampAxis(pan.y, maxY),
  };
}

/** Calculate the visible canvas rectangle inside the minimap, including letterboxing. */
export function calculateMinimapViewport({
  zoom,
  pan,
  minimapWidth,
  minimapHeight,
  containerWidth,
  containerHeight,
  svgWidth,
  svgHeight,
  viewBox,
}: MinimapViewportParams): MinimapViewportResult {
  const safeZoom = Math.max(0.1, Number.isFinite(zoom) ? zoom : 1);
  const mapBounds = fitMapRect(minimapWidth, minimapHeight, viewBox);
  const canvasMap = fitMapRect(svgWidth, svgHeight, viewBox);
  const visibleRatioX = canvasMap.width
    ? Math.max(0, containerWidth / (canvasMap.width * safeZoom))
    : 1;
  const visibleRatioY = canvasMap.height
    ? Math.max(0, containerHeight / (canvasMap.height * safeZoom))
    : 1;
  const rectWidth = Math.min(mapBounds.width, mapBounds.width * visibleRatioX);
  const rectHeight = Math.min(
    mapBounds.height,
    mapBounds.height * visibleRatioY,
  );
  const panRatioX = canvasMap.width ? pan.x / (canvasMap.width * safeZoom) : 0;
  const panRatioY = canvasMap.height
    ? pan.y / (canvasMap.height * safeZoom)
    : 0;

  const rectX = Math.min(
    mapBounds.x + mapBounds.width - rectWidth,
    Math.max(
      mapBounds.x,
      mapBounds.x +
        mapBounds.width / 2 -
        rectWidth / 2 -
        panRatioX * mapBounds.width,
    ),
  );
  const rectY = Math.min(
    mapBounds.y + mapBounds.height - rectHeight,
    Math.max(
      mapBounds.y,
      mapBounds.y +
        mapBounds.height / 2 -
        rectHeight / 2 -
        panRatioY * mapBounds.height,
    ),
  );

  return {
    scaleRatio: 1 / safeZoom,
    rectWidth,
    rectHeight,
    rectX,
    rectY,
    mapBounds,
  };
}

/** Translate a minimap click into a clamped canvas pan position. */
export function minimapClickToPan({
  clickX,
  clickY,
  mapBounds,
  ...panParams
}: MinimapClickParams): { x: number; y: number } {
  if (!mapBounds.width || !mapBounds.height) return { x: 0, y: 0 };
  const normalizedX = Math.min(
    1,
    Math.max(0, (clickX - mapBounds.x) / mapBounds.width),
  );
  const normalizedY = Math.min(
    1,
    Math.max(0, (clickY - mapBounds.y) / mapBounds.height),
  );
  const canvasMap = fitMapRect(
    panParams.svgWidth,
    panParams.svgHeight,
    panParams.viewBox,
  );
  if (!canvasMap.width || !canvasMap.height) return { x: 0, y: 0 };

  return clampPanToMap({
    ...panParams,
    pan: {
      x: (0.5 - normalizedX) * canvasMap.width * panParams.zoom,
      y: (0.5 - normalizedY) * canvasMap.height * panParams.zoom,
    },
  });
}

/** Parses SVG viewBox string "minX minY width height" into numeric components. */
export function parseViewBox(viewBox: string): {
  minX: number;
  minY: number;
  width: number;
  height: number;
} {
  const parts = viewBox
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (parts.length !== 4 || !parts.every(Number.isFinite)) {
    return { minX: 0, minY: 0, width: 0, height: 0 };
  }

  const [minX, minY, width, height] = parts;
  return {
    minX,
    minY,
    width: width > 0 ? width : 0,
    height: height > 0 ? height : 0,
  };
}

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
 * Suc chua uoc tinh (so cho) cua tung so do. Day la du lieu quyet dinh "map lon".
 * Khong dung so luong khu de suy ra vi arena-basketball co 79 khu (gan bang san van dong)
 * nhung la nha thi dau nho. Them map moi thi phai khai bao o day (co test kiem tra).
 */
export const VENUE_MAP_CAPACITY: Record<string, number> = {
  "arena-t-stage": 12000,
  "stadium-concert": 40000,
  "stadium-football": 30000,
  "arena-basketball": 6000,
  theater: 2000,
  "mega-festival": 80000,
  "concert-open-air": 15000,
  "theater-hoa-binh": 2500,
  "football-hang-day": 22000,
  "basketball-saigon-heat": 3500,
  "opera-nha-hat-lon": 1200,
};

/** Tu muc suc chua nay tro len map duoc coi la lon va luon hien minimap. */
export const LARGE_VENUE_CAPACITY = 20000;

/**
 * Decision helper for displaying minimap (W03-FE2).
 * Minimap is shown for large venues (capacity >= LARGE_VENUE_CAPACITY)
 * or when the user zooms in (zoom > 1.25) and can no longer see the whole map.
 */
export function shouldShowMinimap(
  mapKey?: string | null,
  zoom = 1,
): boolean {
  const capacity = mapKey ? VENUE_MAP_CAPACITY[mapKey] : undefined;
  const isLargeVenue =
    capacity !== undefined && capacity >= LARGE_VENUE_CAPACITY;
  return isLargeVenue || zoom > 1.25;
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
  action: "LOGIN" | "WAITING_ROOM" | "REFRESH" | "RETRY" | "NONE";
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
      if (
        code === "MISSING_ADMISSION_TOKEN" ||
        code === "INVALID_ADMISSION_TOKEN"
      ) {
        return {
          message:
            "Sự kiện đang bật hàng chờ ảo. Vui lòng xếp hàng để được vào chọn vé.",
          action: "WAITING_ROOM",
        };
      }
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
