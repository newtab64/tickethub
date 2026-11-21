"use client";

import type { GateScannerScreen } from "./use-gate-scanner-screen";

/** Nhat ky cac luot quet gan nhat tai cong truc. */
export function GateHistoryList({ vm }: { vm: GateScannerScreen }) {
  const { history, validCount, rejectedCount } = vm;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold text-foreground">
          Lịch sử soát vé gần đây
        </h2>
        <div className="flex items-center gap-2 text-[12px] font-semibold">
          <span className="rounded-full bg-accent text-accent-foreground px-2.5 py-0.5">
            Hợp lệ: {validCount}
          </span>
          <span className="rounded-full bg-destructive/10 text-destructive px-2.5 py-0.5">
            Từ chối: {rejectedCount}
          </span>
        </div>
      </div>

      {history.length === 0 ? (
        <p className="text-[13px] text-muted-foreground py-4 text-center">
          Chưa có lượt soát vé nào trong ca trực này.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {history.map((item) => (
            <div
              key={item.id}
              className="py-3 flex items-center justify-between gap-3 text-[13px]"
            >
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">
                  {item.ticketCode || "Mã quét không xác định"}
                  {item.buyerName ? ` - ${item.buyerName}` : ""}
                </p>
                <p className="text-[12px] text-muted-foreground truncate">
                  {item.scannedAt} -{" "}
                  {item.mode === "QR" ? "Quét QR" : "Tra cứu thủ công"} -{" "}
                  {item.detail}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  item.verdict === "VALID"
                    ? "bg-accent text-accent-foreground"
                    : item.verdict === "DUPLICATE" || item.verdict === "EXPIRED"
                      ? "bg-amber-100 text-amber-900"
                      : "bg-destructive/10 text-destructive"
                }`}
              >
                {item.verdict === "VALID"
                  ? "Hợp lệ"
                  : item.verdict === "DUPLICATE"
                    ? "Quét trùng"
                    : item.verdict === "EXPIRED"
                      ? "Hết hạn"
                      : "Từ chối"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
