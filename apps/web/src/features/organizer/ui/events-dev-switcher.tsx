"use client";

import type { OrganizerEventsScreen } from "./use-organizer-events-screen";

/** Khoi giao dien: dev-state-switcher. */
export function EventsDevSwitcher({ vm }: { vm: OrganizerEventsScreen }) {
  const { previewState, setPreviewState, isDev } = vm;

  return (
    <>
      {isDev && (
        <aside
          aria-label="Bảng điều khiển thử nghiệm nhà phát triển"
          className="fixed bottom-4 right-4 z-40 p-1.5 rounded-lg border border-border bg-background/95 backdrop-blur shadow-lg flex items-center gap-1 text-xs"
        >
          <span className="px-2 py-0.5 text-muted-foreground font-medium hidden sm:inline">
            Xem trước:
          </span>
          <button
            type="button"
            onClick={() => setPreviewState("NORMAL")}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              previewState === "NORMAL"
                ? "bg-secondary text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Bình thường
          </button>
          <button
            type="button"
            onClick={() => setPreviewState("LOADING")}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              previewState === "LOADING"
                ? "bg-secondary text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Đang tải
          </button>
          <button
            type="button"
            onClick={() => setPreviewState("EMPTY")}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              previewState === "EMPTY"
                ? "bg-secondary text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Trống
          </button>
          <button
            type="button"
            onClick={() => setPreviewState("ERROR")}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              previewState === "ERROR"
                ? "bg-secondary text-destructive font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Lỗi API
          </button>
        </aside>
      )}
    </>
  );
}
