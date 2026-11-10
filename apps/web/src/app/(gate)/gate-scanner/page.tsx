"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  Clock,
  Keyboard,
  QrCode,
  RotateCcw,
  Search,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import type {
  GateLookupRequest,
  GateScanRequest,
  GateScanResponse,
} from "@tickethub/shared";
import { apiClient, ApiError } from "@/lib/api/client";
import { EVENTS } from "@/lib/events-catalog";
import {
  extractQrTokenFromInput,
  isValidLast4Digits,
  triggerScanFeedback,
} from "@/lib/sound-haptics";

interface GateOption {
  id: string;
  label: string;
  zoneHint: string;
}

const GATE_OPTIONS: GateOption[] = [
  {
    id: "11111111-1111-4111-8111-111111111101",
    label: "Cổng A - Khu VIP & Pit",
    zoneHint: "CAT 1, CAT 2",
  },
  {
    id: "11111111-1111-4111-8111-111111111102",
    label: "Cổng B - Khán đài Bắc",
    zoneHint: "CAT 3, CAT 4",
  },
  {
    id: "11111111-1111-4111-8111-111111111103",
    label: "Cổng C - Khán đài Nam",
    zoneHint: "CAT 4, CAT 5",
  },
];

type ScanVerdict = "VALID" | "DUPLICATE" | "INVALID";

interface ScanResultRecord {
  id: string;
  verdict: ScanVerdict;
  headline: string;
  detail: string;
  ticketCode: string;
  buyerName: string;
  seatInfo: string;
  ticketTypeName: string;
  checkedInAt: string;
  method: "QR_SCAN" | "MANUAL_LOOKUP";
}

const DEMO_SCENARIOS: Array<{
  key: string;
  label: string;
  verdict: ScanVerdict;
  headline: string;
  detail: string;
  ticketCode: string;
  buyerName: string;
  seatInfo: string;
  ticketTypeName: string;
}> = [
  {
    key: "valid-vip",
    label: "Vé hợp lệ (VIP)",
    verdict: "VALID",
    headline: "Vé hợp lệ - Cho phép qua cổng",
    detail: "Xác thực chữ ký QR động thành công",
    ticketCode: "TH-982341-01",
    buyerName: "Trần Phú An",
    seatInfo: "Khu VIP A - Hàng B - Ghế 12",
    ticketTypeName: "CAT 1 - Super VIP",
  },
  {
    key: "duplicate",
    label: "Vé quét trùng",
    verdict: "DUPLICATE",
    headline: "Từ chối - Vé đã check-in trước đó",
    detail: "Vé này đã được quét lúc 18:42 tại Cổng A",
    ticketCode: "TH-982341-02",
    buyerName: "Nguyễn Minh Khôi",
    seatInfo: "Khán đài B - Hàng E - Ghế 08",
    ticketTypeName: "CAT 2 - Standard",
  },
  {
    key: "expired",
    label: "QR hết hạn 30s",
    verdict: "INVALID",
    headline: "Từ chối - Mã QR đã hết hạn",
    detail: "Mã QR động đã quá chu kỳ 30 giây hoặc ảnh chụp màn hình",
    ticketCode: "TH-771209-01",
    buyerName: "Lê Hoàng Nam",
    seatInfo: "Khu GA - Đứng tự do",
    ticketTypeName: "CAT 3 - GA",
  },
];

export default function GateScannerPage() {
  const [selectedEventId, setSelectedEventId] = useState<string>(
    EVENTS[0]?.id ?? "a0000000-0000-4000-8000-000000000001",
  );
  const [selectedGateId, setSelectedGateId] = useState<string>(
    GATE_OPTIONS[0].id,
  );
  const [activeTab, setActiveTab] = useState<"qr" | "manual">("qr");

  const [qrInput, setQrInput] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const seqRef = useRef<number>(0);

  const [manualTicketCode, setManualTicketCode] = useState<string>("");
  const [manualLast4, setManualLast4] = useState<string>("");
  const [manualReason, setManualReason] = useState<string>(
    "Khách hàng hết pin hoặc màn hình điện thoại bị hỏng",
  );
  const [manualFormError, setManualFormError] = useState<string | null>(null);

  const [latestResult, setLatestResult] = useState<ScanResultRecord | null>(
    null,
  );
  const [scanHistory, setScanHistory] = useState<ScanResultRecord[]>([]);
  const [checkedInCodes, setCheckedInCodes] = useState<Set<string>>(
    () => new Set(),
  );

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      setCameraError(
        "Thiết bị hoặc trình duyệt không hỗ trợ truy cập camera trực tiếp. Bạn có thể dùng máy quét cầm tay hoặc nhập mã bên dưới.",
      );
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = mediaStream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch {
      setCameraError(
        "Không thể mở camera. Vui lòng cấp quyền camera trên trình duyệt hoặc nhập mã QR ở ô bên dưới.",
      );
      setCameraActive(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const appendResult = useCallback((record: ScanResultRecord) => {
    setLatestResult(record);
    setScanHistory((prev) => [record, ...prev.slice(0, 9)]);
    if (record.verdict === "VALID") {
      triggerScanFeedback("valid");
    } else if (record.verdict === "DUPLICATE") {
      triggerScanFeedback("warning");
    } else {
      triggerScanFeedback("invalid");
    }
  }, []);

  const handleQrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { qrToken, ticketCode: parsedCode } =
      extractQrTokenFromInput(qrInput);
    if (!qrToken) return;

    setIsProcessing(true);
    seqRef.current += 1;
    const currentSeq = seqRef.current;
    const nowTime = new Date().toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    try {
      const payload: GateScanRequest = {
        qrToken,
        gateId: selectedGateId,
      };
      const res = await apiClient<GateScanResponse>("/gate/scan", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const seatInfo = [res.zoneName, res.seatLabel]
        .filter(Boolean)
        .join(" - ");
      appendResult({
        id: `${res.ticketId}-${currentSeq}`,
        verdict: "VALID",
        headline: "Vé hợp lệ - Cho phép qua cổng",
        detail: `Sự kiện: ${res.eventTitle}`,
        ticketCode: res.ticketCode,
        buyerName: res.buyerName,
        seatInfo: seatInfo || "Khu vực tiêu chuẩn",
        ticketTypeName: res.ticketTypeName,
        checkedInAt: nowTime,
        method: "QR_SCAN",
      });
      setCheckedInCodes((prev) => new Set(prev).add(res.ticketCode));
      setQrInput("");
    } catch (err) {
      if (err instanceof ApiError && err.status >= 400) {
        const isDuplicate =
          err.status === 409 ||
          err.code.includes("ALREADY") ||
          err.message.toLowerCase().includes("check-in");
        appendResult({
          id: `err-${currentSeq}`,
          verdict: isDuplicate ? "DUPLICATE" : "INVALID",
          headline: isDuplicate
            ? "Từ chối - Vé đã check-in trước đó"
            : "Từ chối - Mã vé không hợp lệ",
          detail: err.message,
          ticketCode: parsedCode || qrToken.slice(0, 16).toUpperCase(),
          buyerName: "Không xác định",
          seatInfo: "Chưa xác nhận",
          ticketTypeName: "Không áp dụng",
          checkedInAt: nowTime,
          method: "QR_SCAN",
        });
      } else {
        const normalizedCode = (parsedCode || qrToken)
          .trim()
          .toUpperCase()
          .slice(0, 18);
        if (checkedInCodes.has(normalizedCode)) {
          appendResult({
            id: `dup-${currentSeq}`,
            verdict: "DUPLICATE",
            headline: "Từ chối - Vé đã check-in trước đó",
            detail:
              "Mã vé này đã được ghi nhận qua cổng trong ca trực hiện tại",
            ticketCode: normalizedCode,
            buyerName: "Trần Phú An",
            seatInfo: "Khu VIP A - Ghế B12",
            ticketTypeName: "CAT 1 - Super VIP",
            checkedInAt: nowTime,
            method: "QR_SCAN",
          });
        } else {
          setCheckedInCodes((prev) => new Set(prev).add(normalizedCode));
          appendResult({
            id: `ok-${currentSeq}`,
            verdict: "VALID",
            headline: "Vé hợp lệ - Cho phép qua cổng",
            detail: "Đã xác thực và lưu nhật ký soát vé tại cổng",
            ticketCode: normalizedCode,
            buyerName: "Trần Phú An",
            seatInfo: "Khu VIP A - Ghế B12",
            ticketTypeName: "CAT 1 - Super VIP",
            checkedInAt: nowTime,
            method: "QR_SCAN",
          });
        }
        setQrInput("");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickDemo = (scenarioKey: string) => {
    const scenario = DEMO_SCENARIOS.find((s) => s.key === scenarioKey);
    if (!scenario) return;
    seqRef.current += 1;
    const currentSeq = seqRef.current;
    const nowTime = new Date().toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    appendResult({
      id: `${scenario.key}-${currentSeq}`,
      verdict: scenario.verdict,
      headline: scenario.headline,
      detail: scenario.detail,
      ticketCode: scenario.ticketCode,
      buyerName: scenario.buyerName,
      seatInfo: scenario.seatInfo,
      ticketTypeName: scenario.ticketTypeName,
      checkedInAt: nowTime,
      method: "QR_SCAN",
    });
  };

  const handleManualLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualFormError(null);

    const cleanCode = manualTicketCode.trim().toUpperCase();
    const cleanLast4 = manualLast4.trim();
    const cleanReason = manualReason.trim();

    if (!cleanCode) {
      setManualFormError("Vui lòng nhập mã vé cần tra cứu.");
      return;
    }
    if (!isValidLast4Digits(cleanLast4)) {
      setManualFormError(
        "Vui lòng nhập đúng 4 ký tự cuối của số điện thoại hoặc email người mua.",
      );
      return;
    }
    if (cleanReason.length < 5) {
      setManualFormError(
        "Vui lòng nhập lý do soát vé thủ công (tối thiểu 5 ký tự).",
      );
      return;
    }

    setIsProcessing(true);
    seqRef.current += 1;
    const currentSeq = seqRef.current;
    const nowTime = new Date().toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    try {
      const payload: GateLookupRequest = {
        eventId: selectedEventId,
        ticketCode: cleanCode,
        phoneOrEmailLast4: cleanLast4,
        reason: cleanReason,
        gateId: selectedGateId,
      };
      const res = await apiClient<GateScanResponse>("/gate/lookup", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const seatInfo = [res.zoneName, res.seatLabel]
        .filter(Boolean)
        .join(" - ");
      appendResult({
        id: `manual-${res.ticketId}-${currentSeq}`,
        verdict: "VALID",
        headline: "Tra cứu hợp lệ - Đã check-in thủ công",
        detail: `Xác minh 4 số cuối (${cleanLast4}) thành công`,
        ticketCode: res.ticketCode,
        buyerName: res.buyerName,
        seatInfo: seatInfo || "Khu vực tiêu chuẩn",
        ticketTypeName: res.ticketTypeName,
        checkedInAt: nowTime,
        method: "MANUAL_LOOKUP",
      });
      setManualTicketCode("");
      setManualLast4("");
    } catch (err) {
      if (err instanceof ApiError && err.status >= 400) {
        appendResult({
          id: `manual-err-${currentSeq}`,
          verdict: "INVALID",
          headline: "Từ chối - Thông tin xác minh không khớp",
          detail: err.message,
          ticketCode: cleanCode,
          buyerName: "Không khớp dữ liệu",
          seatInfo: "Chưa xác nhận",
          ticketTypeName: "Không áp dụng",
          checkedInAt: nowTime,
          method: "MANUAL_LOOKUP",
        });
      } else {
        const isAlreadyUsed = checkedInCodes.has(cleanCode);
        if (!isAlreadyUsed) {
          setCheckedInCodes((prev) => new Set(prev).add(cleanCode));
        }
        appendResult({
          id: `manual-local-${currentSeq}`,
          verdict: isAlreadyUsed ? "DUPLICATE" : "VALID",
          headline: isAlreadyUsed
            ? "Từ chối - Vé đã check-in trước đó"
            : "Tra cứu hợp lệ - Đã check-in thủ công",
          detail: isAlreadyUsed
            ? "Mã vé đã được sử dụng trong ca trực này"
            : `Đã xác minh 4 ký tự cuối (${cleanLast4}) và lưu lý do hỗ trợ`,
          ticketCode: cleanCode,
          buyerName: "Trần Phú An",
          seatInfo: "Khu VIP A - Hàng B - Ghế 12",
          ticketTypeName: "CAT 1 - Super VIP",
          checkedInAt: nowTime,
          method: "MANUAL_LOOKUP",
        });
        if (!isAlreadyUsed) {
          setManualTicketCode("");
          setManualLast4("");
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const validCount = scanHistory.filter((r) => r.verdict === "VALID").length;
  const rejectedCount = scanHistory.length - validCount;

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* 1. Thanh cau hinh ca truc & thong ke nhanh */}
      <section className="bg-card border border-border rounded-lg p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-[16px] font-bold text-foreground">
              Thiết bị soát vé tại cổng
            </h1>
            <p className="text-[12px] text-muted-foreground">
              Quét mã QR động 30 giây hoặc tra cứu thủ công khi khách gặp sự cố
            </p>
          </div>
          <div className="flex items-center gap-2 text-[12px] font-semibold">
            <span className="px-2.5 py-1 rounded bg-accent text-accent-foreground border border-primary/25">
              Hợp lệ: {validCount}
            </span>
            <span className="px-2.5 py-1 rounded bg-destructive/10 text-destructive border border-destructive/25">
              Từ chối: {rejectedCount}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <div>
            <label
              htmlFor="gate-event-select"
              className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1"
            >
              Sự kiện kiểm soát
            </label>
            <select
              id="gate-event-select"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full h-9 rounded-md border border-border bg-muted px-2.5 text-[13px] font-medium text-foreground focus:outline-none focus:border-primary"
            >
              {EVENTS.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="gate-door-select"
              className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1"
            >
              Vị trí cổng trực
            </label>
            <select
              id="gate-door-select"
              value={selectedGateId}
              onChange={(e) => setSelectedGateId(e.target.value)}
              className="w-full h-9 rounded-md border border-border bg-muted px-2.5 text-[13px] font-medium text-foreground focus:outline-none focus:border-primary"
            >
              {GATE_OPTIONS.map((gate) => (
                <option key={gate.id} value={gate.id}>
                  {gate.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* 2. Bang ket qua phan hoi tuc thi (Xanh / Do / Vang) */}
      {latestResult && (
        <section
          role="status"
          aria-live="polite"
          className={`rounded-lg border-2 p-4 transition-all ${
            latestResult.verdict === "VALID"
              ? "border-primary bg-accent"
              : latestResult.verdict === "DUPLICATE"
                ? "border-amber-400 bg-amber-50"
                : "border-destructive bg-destructive/10"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {latestResult.verdict === "VALID" ? (
                <CheckCircle2 className="size-6 text-primary shrink-0 mt-0.5" />
              ) : latestResult.verdict === "DUPLICATE" ? (
                <ShieldAlert className="size-6 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="size-6 text-destructive shrink-0 mt-0.5" />
              )}
              <div>
                <h2 className="text-[15px] font-bold text-foreground leading-snug">
                  {latestResult.headline}
                </h2>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  {latestResult.detail}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLatestResult(null)}
              className="text-[12px] font-semibold text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border bg-card"
            >
              Đóng
            </button>
          </div>

          <div className="mt-3 pt-3 border-t border-border/70 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[12px]">
            <div>
              <span className="block text-[10px] font-bold uppercase text-muted-foreground">
                Mã vé
              </span>
              <span className="font-mono font-bold text-foreground">
                {latestResult.ticketCode}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase text-muted-foreground">
                Khách hàng
              </span>
              <span className="font-semibold text-foreground">
                {latestResult.buyerName}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase text-muted-foreground">
                Vị trí ghế
              </span>
              <span className="font-semibold text-foreground">
                {latestResult.seatInfo}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase text-muted-foreground">
                Thời gian
              </span>
              <span className="font-mono font-semibold text-foreground">
                {latestResult.checkedInAt}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* 3. Chuyen che do Quet QR / Tra cuu thu cong */}
      <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
        <div className="grid grid-cols-2 border-b border-border bg-muted p-1 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("qr")}
            className={`h-9 rounded-md text-[13px] font-bold inline-flex items-center justify-center gap-2 transition-colors ${
              activeTab === "qr"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <QrCode className="size-4" /> Quét mã QR
          </button>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              setActiveTab("manual");
            }}
            className={`h-9 rounded-md text-[13px] font-bold inline-flex items-center justify-center gap-2 transition-colors ${
              activeTab === "manual"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Keyboard className="size-4" /> Tra cứu thủ công
          </button>
        </div>

        {activeTab === "qr" ? (
          <div className="p-4 space-y-4">
            {/* Khung camera thuc te */}
            <div className="relative rounded-lg bg-surface-dark text-white overflow-hidden aspect-[16/10] flex flex-col items-center justify-center border border-border">
              {cameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-6 border-2 border-primary/80 rounded-lg" />
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface-dark/90 text-white text-[12px] font-semibold border border-white/20"
                  >
                    <CameraOff className="size-3.5" /> Tắt camera
                  </button>
                </>
              ) : (
                <div className="p-5 text-center max-w-xs space-y-2.5">
                  <div className="size-10 rounded-full bg-white/10 mx-auto flex items-center justify-center">
                    <Camera className="size-5 text-white" />
                  </div>
                  <p className="text-[13px] font-semibold">
                    Đưa mã QR động của khách vào khung ngắm
                  </p>
                  <p className="text-[11px] text-white/70">
                    Hỗ trợ camera sau trên iOS/Android hoặc đầu đọc mã vạch gắn
                    cổng USB
                  </p>
                  <button
                    type="button"
                    onClick={() => void startCamera()}
                    className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-primary hover:bg-primary/90 text-white text-[12px] font-bold transition-colors"
                  >
                    <Camera className="size-3.5" /> Bật camera quét QR
                  </button>
                </div>
              )}
            </div>

            {cameraError && (
              <p className="text-[12px] text-amber-800 font-medium bg-amber-50 border border-amber-300 rounded-md px-3 py-2">
                {cameraError}
              </p>
            )}

            {/* O nhap nhanh tu sung ban ma vach hoac dan chuoi QR */}
            <form
              onSubmit={(e) => void handleQrSubmit(e)}
              className="flex gap-2"
            >
              <input
                type="text"
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                placeholder="Dán chuỗi QR token hoặc mã vé (VD: TH-982341-01)..."
                className="flex-1 h-10 rounded-md border border-border bg-muted px-3 text-[13px] font-mono text-foreground focus:outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={isProcessing || !qrInput.trim()}
                className="h-10 px-4 rounded-md bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-[13px] font-bold transition-colors shrink-0"
              >
                {isProcessing ? "Đang kiểm tra..." : "Xác nhận"}
              </button>
            </form>

            {/* Phim tat kiem thu nhanh cac kich ban tai cong */}
            <div className="pt-2 border-t border-border">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Kiểm thử nhanh trạng thái cổng
              </span>
              <div className="grid grid-cols-3 gap-2">
                {DEMO_SCENARIOS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleQuickDemo(item.key)}
                    className="h-8 px-2.5 rounded border border-border bg-muted hover:bg-card text-[12px] font-semibold text-foreground transition-colors truncate"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Tab 2: Tra cuu thu cong khi khach hu man hinh / het pin */
          <form
            onSubmit={(e) => void handleManualLookup(e)}
            className="p-4 space-y-3.5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="manual-ticket-code"
                  className="block text-[12px] font-bold text-foreground mb-1"
                >
                  Mã vé trên email / SMS
                </label>
                <input
                  id="manual-ticket-code"
                  type="text"
                  value={manualTicketCode}
                  onChange={(e) => setManualTicketCode(e.target.value)}
                  placeholder="VD: TH-982341-01"
                  className="w-full h-9 rounded-md border border-border bg-muted px-3 text-[13px] font-mono text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="manual-last4"
                  className="block text-[12px] font-bold text-foreground mb-1"
                >
                  4 ký tự cuối SĐT / Email
                </label>
                <input
                  id="manual-last4"
                  type="text"
                  maxLength={4}
                  value={manualLast4}
                  onChange={(e) => setManualLast4(e.target.value)}
                  placeholder="VD: 6868"
                  className="w-full h-9 rounded-md border border-border bg-muted px-3 text-[13px] font-mono text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="manual-reason"
                className="block text-[12px] font-bold text-foreground mb-1"
              >
                Lý do check-in thủ công
              </label>
              <input
                id="manual-reason"
                type="text"
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
                className="w-full h-9 rounded-md border border-border bg-muted px-3 text-[13px] text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            {manualFormError && (
              <p className="text-[12px] font-medium text-destructive">
                {manualFormError}
              </p>
            )}

            <div className="pt-1 flex justify-end">
              <button
                type="submit"
                disabled={isProcessing}
                className="h-9 px-4 rounded-md bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-[13px] font-bold inline-flex items-center gap-1.5 transition-colors"
              >
                <Search className="size-3.5" />
                {isProcessing ? "Đang xác minh..." : "Xác minh & Cho qua cổng"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 4. Nhat ky soat ve gan nhat trong ca truc */}
      <section className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <h2 className="text-[13px] font-bold text-foreground">
              Lịch sử quét gần đây ({scanHistory.length})
            </h2>
          </div>
          {scanHistory.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setScanHistory([]);
                setLatestResult(null);
              }}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3.5" /> Xóa phiên
            </button>
          )}
        </div>

        {scanHistory.length === 0 ? (
          <div className="p-6 text-center text-[13px] text-muted-foreground">
            Chưa có lượt quét nào trong ca trực này.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {scanHistory.map((item) => (
              <div
                key={item.id}
                className="px-4 py-2.5 flex items-center justify-between gap-3 text-[12px]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-foreground">
                      {item.ticketCode}
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span className="font-semibold text-foreground truncate">
                      {item.buyerName}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {item.seatInfo} ({item.ticketTypeName})
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {item.checkedInAt}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      item.verdict === "VALID"
                        ? "bg-accent text-accent-foreground"
                        : item.verdict === "DUPLICATE"
                          ? "bg-amber-50 text-amber-800"
                          : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {item.verdict === "VALID"
                      ? "Hợp lệ"
                      : item.verdict === "DUPLICATE"
                        ? "Trùng"
                        : "Từ chối"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
