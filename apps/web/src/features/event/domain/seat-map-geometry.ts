/**
 * Utility functions for SeatMap and Minimap calculations (UC04)
 */

export interface MapRect {
  x: number;
  y: number;
  width: number;
  height: number;
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
