"use client";

import { type VietnamCity } from "@/features/venue";
import { type SelectOption } from "@/shared/ui/custom-select";

export const CITY_TABS: Array<{
  id: VietnamCity | "ALL";
  label: string;
  count: number;
}> = [
  { id: "ALL", label: "Tất cả", count: 11 },
  { id: "TP. Hồ Chí Minh", label: "TP. Hồ Chí Minh", count: 4 },
  { id: "Hà Nội", label: "Hà Nội", count: 4 },
  { id: "Đà Nẵng", label: "Đà Nẵng", count: 3 },
];

export const CATEGORY_OPTIONS: SelectOption[] = [
  { value: "Âm nhạc", label: "Âm nhạc" },
  { value: "Thể thao", label: "Thể thao" },
  { value: "Sân khấu & Nghệ thuật", label: "Sân khấu & Nghệ thuật" },
  { value: "Hội thảo & Sự kiện", label: "Hội thảo & Sự kiện" },
  { value: "Khác", label: "Khác" },
];

export interface FormErrors {
  title?: string;
  category?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  venue?: string;
}
