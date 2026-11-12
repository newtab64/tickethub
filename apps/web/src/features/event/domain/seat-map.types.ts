import { SeatStatus } from "@tickethub/shared";

export type { SeatStatus };

export interface MinimapViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ZoneInfoItem {
  id: string;
  name: string;
  minPrice: number;
  count: number;
  status?: SeatStatus;
}
