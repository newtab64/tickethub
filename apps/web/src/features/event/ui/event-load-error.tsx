"use client";

import { Button } from "@/shared/ui/button";

/** Loi tai su kien: bao ro va cho thu lai. */
export function EventLoadError({ retry }: { retry: () => void }) {
  return (
    <div
      role="alert"
      className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center"
    >
      <p className="font-semibold">Không tải được sự kiện. Vui lòng thử lại.</p>
      <Button onClick={() => retry()}>Thử lại</Button>
    </div>
  );
}
