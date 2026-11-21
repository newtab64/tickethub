"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EVENTS } from "@/features/event";
import {
  GATE_OPTIONS,
  extractQrTokenFromInput,
  isValidLast4Digits,
  type ScanFeedbackState,
  type ScanHistoryEntry,
} from "../domain/gate-rules";
import { lookupGateTicket, scanGateTicket } from "../api/gate-api";
import { triggerScanFeedback } from "./sound-haptics";

export type ScannerMode = "QR" | "MANUAL";

export function useGateScannerScreen() {
  const [selectedEventId, setSelectedEventId] = useState<string>(
    EVENTS[0]?.id ?? "evt-1",
  );
  const [selectedGateId, setSelectedGateId] = useState<string>(
    GATE_OPTIONS[0]!.id,
  );
  const [mode, setMode] = useState<ScannerMode>("QR");

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [qrInput, setQrInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [manualTicketCode, setManualTicketCode] = useState("");
  const [manualLast4, setManualLast4] = useState("");
  const [manualReason, setManualReason] = useState(
    "Điện thoại khách hết pin tại cổng",
  );
  const [manualError, setManualError] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<ScanFeedbackState | null>(null);
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastScannedRef = useRef<{ token: string; at: number }>({
    token: "",
    at: 0,
  });

  const recordFeedback = useCallback(
    (result: ScanFeedbackState, entryMode: ScannerMode) => {
      setFeedback(result);
      triggerScanFeedback(result.verdict);
      setHistory((prev) => [
        {
          ...result,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          scannedAt: new Date().toLocaleTimeString("vi-VN"),
          mode: entryMode,
        },
        ...prev.slice(0, 19),
      ]);
    },
    [],
  );

  const handleSubmitQr = useCallback(
    async (rawInput: string) => {
      const { qrToken, ticketCode } = extractQrTokenFromInput(rawInput);
      if (!qrToken) return;

      const now = Date.now();
      if (
        lastScannedRef.current.token === qrToken &&
        now - lastScannedRef.current.at < 2500
      ) {
        return;
      }
      lastScannedRef.current = { token: qrToken, at: now };

      setIsSubmitting(true);
      const result = await scanGateTicket(
        { qrToken, gateId: selectedGateId },
        ticketCode,
      );
      recordFeedback(result, "QR");
      setIsSubmitting(false);
      setQrInput("");
    },
    [selectedGateId, recordFeedback],
  );

  const handleSubmitManualLookup = useCallback(async () => {
    setManualError(null);
    const code = manualTicketCode.trim().toUpperCase();
    const last4 = manualLast4.trim();
    const reason = manualReason.trim();

    if (!code) {
      setManualError("Vui lòng nhập mã vé cần kiểm tra.");
      return;
    }
    if (!isValidLast4Digits(last4)) {
      setManualError("Nhập đúng 4 ký tự cuối của số điện thoại hoặc email.");
      return;
    }
    if (reason.length < 5) {
      setManualError("Vui lòng ghi rõ lý do hỗ trợ (tối thiểu 5 ký tự).");
      return;
    }

    setIsSubmitting(true);
    const result = await lookupGateTicket({
      eventId: selectedEventId,
      ticketCode: code,
      phoneOrEmailLast4: last4,
      gateId: selectedGateId,
      reason,
    });
    recordFeedback(result, "MANUAL");
    setIsSubmitting(false);
    setManualTicketCode("");
    setManualLast4("");
  }, [
    selectedEventId,
    manualTicketCode,
    manualLast4,
    manualReason,
    selectedGateId,
    recordFeedback,
  ]);

  const stopCamera = useCallback(() => {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setCameraError(
        "Thiết bị chưa hỗ trợ camera trên trình duyệt. Bạn có thể nhập mã bằng tay hoặc dùng đầu đọc cầm tay.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);

      const BarcodeCtor = (
        window as unknown as {
          BarcodeDetector?: new (opts: { formats: string[] }) => {
            detect: (
              source: HTMLVideoElement,
            ) => Promise<Array<{ rawValue?: string }>>;
          };
        }
      ).BarcodeDetector;

      if (BarcodeCtor && videoRef.current) {
        const detector = new BarcodeCtor({ formats: ["qr_code"] });
        scanTimerRef.current = setInterval(() => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          void detector
            .detect(videoRef.current)
            .then((codes) => {
              const first = codes[0]?.rawValue;
              if (first) void handleSubmitQr(first);
            })
            .catch(() => undefined);
        }, 350);
      }
    } catch {
      setCameraError(
        "Không mở được camera. Hãy cấp quyền camera cho trình duyệt hoặc chuyển sang nhập mã thủ công.",
      );
      stopCamera();
    }
  }, [handleSubmitQr, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const validCount = history.filter((h) => h.verdict === "VALID").length;
  const rejectedCount = history.length - validCount;

  return {
    events: EVENTS,
    gates: GATE_OPTIONS,
    selectedEventId,
    setSelectedEventId,
    selectedGateId,
    setSelectedGateId,
    mode,
    setMode,
    cameraActive,
    cameraError,
    startCamera,
    stopCamera,
    videoRef,
    qrInput,
    setQrInput,
    isSubmitting,
    handleSubmitQr,
    manualTicketCode,
    setManualTicketCode,
    manualLast4,
    setManualLast4,
    manualReason,
    setManualReason,
    manualError,
    handleSubmitManualLookup,
    feedback,
    clearFeedback: () => setFeedback(null),
    history,
    validCount,
    rejectedCount,
  };
}

export type GateScannerScreen = ReturnType<typeof useGateScannerScreen>;
