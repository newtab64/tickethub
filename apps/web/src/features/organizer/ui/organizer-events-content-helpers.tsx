"use client";

import {
  CheckCircle2,
  Clock,
  FileText,
  PauseCircle,
  XCircle,
  CheckCheck,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { EventStatus } from "@tickethub/shared";
import { type SelectOption } from "@/shared/ui/custom-select";

export const STATUS_SELECT_OPTIONS: SelectOption[] = [
  { value: "ALL", label: "Tất cả trạng thái" },
  { value: "ACTION_REQUIRED", label: "Cần xử lý (Nháp / Chờ duyệt)" },
  { value: EventStatus.PUBLISHED, label: "Đang mở bán" },
  { value: EventStatus.DRAFT, label: "Bản nháp" },
  { value: EventStatus.PENDING_APPROVAL, label: "Chờ duyệt" },
  { value: EventStatus.SUSPENDED, label: "Tạm dừng" },
  { value: EventStatus.ENDED, label: "Đã kết thúc" },
  { value: EventStatus.CANCELLED, label: "Đã hủy" },
];

export const CITY_SELECT_OPTIONS: SelectOption[] = [
  { value: "ALL", label: "Tất cả thành phố" },
  { value: "TP. Hồ Chí Minh", label: "TP. Hồ Chí Minh" },
  { value: "Hà Nội", label: "Hà Nội" },
  { value: "Đà Nẵng", label: "Đà Nẵng" },
];

// Shortened sort labels so nothing truncates at 1280px
export const SORT_SELECT_OPTIONS: SelectOption[] = [
  { value: "date_asc", label: "Ngày diễn ra (gần nhất)" },
  { value: "date_desc", label: "Ngày diễn ra (xa nhất)" },
  { value: "revenue_desc", label: "Doanh thu (cao nhất)" },
  { value: "sold_desc", label: "Vé bán (nhiều nhất)" },
  { value: "title_asc", label: "Tên sự kiện (A - Z)" },
];

// Icon mapping helper for display statuses
export function getStatusIcon(key: string) {
  switch (key) {
    case "SOLD_OUT":
      return CheckCheck;
    case "ALMOST_SOLD_OUT":
      return AlertCircle;
    case EventStatus.PUBLISHED:
      return CheckCircle2;
    case EventStatus.DRAFT:
      return FileText;
    case EventStatus.PENDING_APPROVAL:
      return Clock;
    case EventStatus.SUSPENDED:
      return PauseCircle;
    case EventStatus.ENDED:
      return CheckCheck;
    case EventStatus.CANCELLED:
      return XCircle;
    default:
      return Calendar;
  }
}

export type PreviewState = "NORMAL" | "LOADING" | "EMPTY" | "ERROR";
