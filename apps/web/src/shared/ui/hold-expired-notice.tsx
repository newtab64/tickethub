"use client";

import { useSearchParams } from "next/navigation";

/** Cảnh báo sau khi checkout chuyển về do hết hạn giữ chỗ. */
export function HoldExpiredNotice() {
  if (useSearchParams().get("holdExpired") !== "1") return null;
  return (
    <p
      role="alert"
      className="mx-auto mt-4 max-w-[1200px] rounded-xl border border-destructive bg-background p-4 text-sm text-destructive"
    >
      Phiên giữ chỗ đã hết hạn và vé đã được trả lại. Vui lòng chọn vé lại.
    </p>
  );
}
