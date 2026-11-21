"use client";

import { Keyboard, QrCode } from "lucide-react";
import { useGateScannerScreen } from "./use-gate-scanner-screen";
import { GateCameraPanel } from "./gate-camera-panel";
import { GateLookupPanel } from "./gate-lookup-panel";
import { GateHistoryList } from "./gate-history-list";

/** Man hinh soat ve tai cong cho nhan vien (quyet QR va tra cuu thu cong). */
export function GateScannerPage() {
  const vm = useGateScannerScreen();

  return (
    <div className="space-y-6">
      {/* Tieu de & bo chon su kien / cong truc */}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
        <div>
          <h1 className="text-[22px] font-bold text-foreground tracking-tight">
            Soát vé tại cổng
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Chọn đúng sự kiện và vị trí cổng trực trước khi bắt đầu kiểm soát
            khán giả.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <label className="block space-y-1">
            <span className="text-[12px] font-semibold text-muted-foreground">
              Sự kiện đang trực
            </span>
            <select
              value={vm.selectedEventId}
              onChange={(e) => vm.setSelectedEventId(e.target.value)}
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-[13px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {vm.events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-[12px] font-semibold text-muted-foreground">
              Vị trí cổng
            </span>
            <select
              value={vm.selectedGateId}
              onChange={(e) => vm.setSelectedGateId(e.target.value)}
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-[13px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {vm.gates.map((gate) => (
                <option key={gate.id} value={gate.id}>
                  {gate.label} ({gate.zoneHint})
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Chuyen che do Quet QR / Tra cuu thu cong */}
        <div className="inline-flex rounded-xl bg-muted p-1 border border-border">
          <button
            type="button"
            onClick={() => vm.setMode("QR")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors cursor-pointer ${
              vm.mode === "QR"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <QrCode className="size-4" />
            Quét mã QR
          </button>
          <button
            type="button"
            onClick={() => vm.setMode("MANUAL")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors cursor-pointer ${
              vm.mode === "MANUAL"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Keyboard className="size-4" />
            Tra cứu thủ công
          </button>
        </div>
      </section>

      {vm.mode === "QR" ? (
        <GateCameraPanel vm={vm} />
      ) : (
        <GateLookupPanel vm={vm} />
      )}

      <GateHistoryList vm={vm} />
    </div>
  );
}
