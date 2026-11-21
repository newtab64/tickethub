"use client";

import { Search } from "lucide-react";
import type { GateScannerScreen } from "./use-gate-scanner-screen";

/** Bieu mau tra cuu thu cong khi khach gap su co dien thoai tai cong. */
export function GateLookupPanel({ vm }: { vm: GateScannerScreen }) {
  const {
    manualTicketCode,
    setManualTicketCode,
    manualLast4,
    setManualLast4,
    manualReason,
    setManualReason,
    manualError,
    isSubmitting,
    handleSubmitManualLookup,
  } = vm;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
      <div>
        <h2 className="text-[16px] font-bold text-foreground">
          Tra cứu và xác nhận thủ công
        </h2>
        <p className="text-[13px] text-muted-foreground">
          Dùng khi điện thoại khách hết pin, vỡ màn hình hoặc không tải được mã
          QR.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmitManualLookup();
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block space-y-1.5">
            <span className="text-[13px] font-semibold text-foreground">
              Mã vé
            </span>
            <input
              type="text"
              value={manualTicketCode}
              onChange={(e) => setManualTicketCode(e.target.value)}
              placeholder="Ví dụ: TH-88412-01"
              className="w-full h-10 rounded-lg border border-input bg-background px-3.5 text-[14px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-[13px] font-semibold text-foreground">
              4 ký tự cuối SĐT hoặc Email
            </span>
            <input
              type="text"
              maxLength={4}
              value={manualLast4}
              onChange={(e) => setManualLast4(e.target.value)}
              placeholder="Ví dụ: 6868"
              className="w-full h-10 rounded-lg border border-input bg-background px-3.5 text-[14px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-[13px] font-semibold text-foreground">
            Lý do hỗ trợ tại cổng
          </span>
          <input
            type="text"
            value={manualReason}
            onChange={(e) => setManualReason(e.target.value)}
            placeholder="Ghi ngắn gọn tình huống cần hỗ trợ..."
            className="w-full h-10 rounded-lg border border-input bg-background px-3.5 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        {manualError && (
          <p className="text-[13px] text-destructive font-medium">
            {manualError}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
        >
          <Search className="size-4" />
          {isSubmitting ? "Đang tra cứu..." : "Xác minh & cho qua cổng"}
        </button>
      </form>
    </section>
  );
}
