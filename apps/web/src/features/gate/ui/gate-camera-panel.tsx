"use client";

import {
  Camera,
  CameraOff,
  CheckCircle2,
  Clock,
  QrCode,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import type { GateScannerScreen } from "./use-gate-scanner-screen";

/** Khung quet camera QR, o nhap ma nhanh va bang phan hoi trang thai ve. */
export function GateCameraPanel({ vm }: { vm: GateScannerScreen }) {
  const {
    cameraActive,
    cameraError,
    startCamera,
    stopCamera,
    videoRef,
    qrInput,
    setQrInput,
    isSubmitting,
    handleSubmitQr,
    feedback,
    clearFeedback,
  } = vm;

  const bannerStyles = feedback
    ? feedback.verdict === "VALID"
      ? "border-primary bg-accent text-accent-foreground"
      : feedback.verdict === "DUPLICATE" || feedback.verdict === "EXPIRED"
        ? "border-amber-400 bg-amber-50 text-amber-900"
        : "border-destructive bg-destructive/10 text-destructive"
    : "";

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-bold text-foreground">
            Quét mã QR vào cổng
          </h2>
          <p className="text-[13px] text-muted-foreground">
            Hướng camera vào mã QR trên điện thoại khách hoặc quét bằng đầu đọc
            cầm tay.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (cameraActive) {
              stopCamera();
            } else {
              void startCamera();
            }
          }}
          className={`inline-flex items-center gap-2 h-9 px-4 rounded-lg text-[13px] font-semibold transition-colors cursor-pointer ${
            cameraActive
              ? "bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          {cameraActive ? (
            <>
              <CameraOff className="size-4" /> Tắt camera
            </>
          ) : (
            <>
              <Camera className="size-4" /> Bật camera
            </>
          )}
        </button>
      </div>

      {/* Khung camera */}
      <div className="relative rounded-xl overflow-hidden bg-surface-dark border border-border aspect-[16/9] max-h-[300px] w-full flex items-center justify-center">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover ${cameraActive ? "block" : "hidden"}`}
        />
        {!cameraActive && (
          <div className="text-center px-6 py-8 space-y-2 text-white/80">
            <QrCode className="size-10 mx-auto text-primary" />
            <p className="text-[14px] font-semibold text-white">
              Camera đang tạm tắt
            </p>
            <p className="text-[12px] text-white/70 max-w-sm mx-auto">
              Bấm &quot;Bật camera&quot; để quét tự động hoặc dán mã QR vào ô
              bên dưới.
            </p>
          </div>
        )}
      </div>

      {cameraError && (
        <p className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2.5">
          {cameraError}
        </p>
      )}

      {/* O nhap nhanh ma QR / dau doc cam tay */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmitQr(qrInput);
        }}
        className="flex flex-col sm:flex-row gap-2.5"
      >
        <input
          type="text"
          value={qrInput}
          onChange={(e) => setQrInput(e.target.value)}
          placeholder="Quét đầu đọc cầm tay hoặc nhập mã QR / mã vé..."
          className="flex-1 h-10 rounded-lg border border-input bg-background px-3.5 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="submit"
          disabled={isSubmitting || !qrInput.trim()}
          className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {isSubmitting ? "Đang kiểm tra..." : "Xác thực vé"}
        </button>
      </form>

      {/* Bang phan hoi ket qua quet */}
      {feedback && (
        <div
          role="status"
          className={`rounded-xl border-2 p-4 sm:p-5 space-y-2.5 ${bannerStyles}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {feedback.verdict === "VALID" ? (
                <CheckCircle2 className="size-6 shrink-0" />
              ) : feedback.verdict === "DUPLICATE" ||
                feedback.verdict === "EXPIRED" ? (
                <ShieldAlert className="size-6 shrink-0" />
              ) : (
                <XCircle className="size-6 shrink-0" />
              )}
              <div>
                <p className="text-[16px] font-bold leading-snug">
                  {feedback.headline}
                </p>
                <p className="text-[13px] opacity-90">{feedback.detail}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={clearFeedback}
              aria-label="Xóa thông báo kết quả"
              className="p-1.5 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
            >
              <RotateCcw className="size-4" />
            </button>
          </div>

          {(feedback.ticketCode || feedback.buyerName || feedback.zoneName) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-current/15 text-[12px]">
              {feedback.ticketCode && (
                <div>
                  <span className="opacity-75 block">Mã vé</span>
                  <strong className="font-mono">{feedback.ticketCode}</strong>
                </div>
              )}
              {feedback.buyerName && (
                <div>
                  <span className="opacity-75 block">Khách hàng</span>
                  <strong>{feedback.buyerName}</strong>
                </div>
              )}
              {feedback.zoneName && (
                <div>
                  <span className="opacity-75 block">Khu vực</span>
                  <strong>{feedback.zoneName}</strong>
                </div>
              )}
              {typeof feedback.latencyMs === "number" && (
                <div className="inline-flex items-center gap-1 self-end">
                  <Clock className="size-3.5" />
                  <span>{feedback.latencyMs} ms</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
