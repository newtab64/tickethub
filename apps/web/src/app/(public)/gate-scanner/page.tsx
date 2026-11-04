"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Wifi,
  WifiOff,
  Volume2,
  VolumeX,
  RefreshCw,
  QrCode,
  Clock,
  Check,
  X,
} from "lucide-react";
import {
  DEFAULT_CHECKIN_EVENT_ID,
  MAX_OFFLINE_QUEUE_SIZE,
  issueDynamicQrToken,
  getGateTicketsForEvent,
  getPublicKeyMetadata,
  verifyOfflineQrToken,
  type ScanCheckinResponse,
  type GateTicketRecord,
  type OfflineScanQueueItem,
  type OfflineSyncResultItem,
} from "@/lib/checkin-engine";
import { triggerScanFeedback } from "@/lib/sound-haptics";
import { EVENTS } from "@/lib/events-catalog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const GATES = [
  { id: "GATE-B2", label: "Cổng B - Cửa B2 (Khán đài Tây)" },
  { id: "GATE-A1", label: "Cổng A - Cửa A1 (Khán đài Chính)" },
  { id: "GATE-VIP", label: "Cổng VIP - Lối vào ưu tiên" },
  { id: "GATE-C1", label: "Cổng C - Cửa C1 (Khán đài Đông)" },
];

export default function GateScannerPwaPage() {
  const [selectedEventId, setSelectedEventId] = useState<string>(
    DEFAULT_CHECKIN_EVENT_ID,
  );
  const [selectedGateId, setSelectedGateId] = useState<string>("GATE-B2");
  const [staffName] = useState<string>("Trần Phú An");
  const [activeTab, setActiveTab] = useState<"SCAN" | "MANUAL" | "OFFLINE">(
    "SCAN",
  );

  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);

  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [qrInputText, setQrInputText] = useState<string>("");
  const [scanResult, setScanResult] = useState<ScanCheckinResponse | null>(
    null,
  );
  const [scanHistory, setScanHistory] = useState<ScanCheckinResponse[]>([]);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [manualResults, setManualResults] = useState<GateTicketRecord[]>(() =>
    getGateTicketsForEvent(DEFAULT_CHECKIN_EVENT_ID),
  );

  const [offlineQueue, setOfflineQueue] = useState<OfflineScanQueueItem[]>(
    () => {
      if (typeof window !== "undefined") {
        try {
          const savedQueue = window.localStorage.getItem(
            "tickethub_offline_queue",
          );
          if (savedQueue) {
            const parsed = JSON.parse(savedQueue);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return parsed.slice(0, MAX_OFFLINE_QUEUE_SIZE);
            }
          }
        } catch {
          // Use seed queue fallback
        }
      }
      return [
        {
          queueId: "off-seed-1",
          ticketId: "tkt-order-88419",
          ticketCode: "TKT-VN-88419-V09",
          eventId: DEFAULT_CHECKIN_EVENT_ID,
          gateId: "GATE-VIP",
          staffName: "Trần Phú An",
          scannedAt: "2026-11-01T18:10:00.000Z",
          qrToken: "{}",
        },
        {
          queueId: "off-seed-2",
          ticketId: "tkt-order-77291",
          ticketCode: "TKT-VN-77291-A08",
          eventId: DEFAULT_CHECKIN_EVENT_ID,
          gateId: "GATE-B2",
          staffName: "Trần Phú An",
          scannedAt: "2026-11-01T18:12:00.000Z",
          qrToken: "{}",
        },
      ];
    },
  );
  const [syncResults, setSyncResults] = useState<OfflineSyncResultItem[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  // UC08-E5: Cache Ed25519 public key metadata & event ticket list into localStorage for offline verification
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        "tickethub_offline_pubkey",
        JSON.stringify(getPublicKeyMetadata()),
      );
      window.localStorage.setItem(
        `tickethub_offline_tickets_${selectedEventId}`,
        JSON.stringify(getGateTicketsForEvent(selectedEventId)),
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [selectedEventId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        "tickethub_offline_queue",
        JSON.stringify(offlineQueue.slice(0, MAX_OFFLINE_QUEUE_SIZE)),
      );
    } catch {
      // Ignore storage errors
    }
  }, [offlineQueue]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
      }
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setCameraError(
        "Thiết bị hoặc trình duyệt không hỗ trợ camera (UC08-E4). Đã chuyển sang chế độ Tra cứu thủ công.",
      );
      setActiveTab("MANUAL");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch {
      setCameraError(
        "Không thể truy cập camera hoặc bị từ chối quyền (UC08-E4). Đã chuyển sang chế độ Tra cứu thủ công.",
      );
      setIsCameraActive(false);
      setActiveTab("MANUAL");
    }
  };

  const executeQrScan = useCallback(
    async (rawToken: string) => {
      if (!rawToken.trim()) return;

      if (isOfflineMode) {
        let cachedTickets = getGateTicketsForEvent(selectedEventId);
        if (typeof window !== "undefined") {
          try {
            const rawCached = window.localStorage.getItem(
              `tickethub_offline_tickets_${selectedEventId}`,
            );
            if (rawCached) {
              cachedTickets = JSON.parse(rawCached) as GateTicketRecord[];
            }
          } catch {
            // Use in-memory fallback
          }
        }

        const { response, queueItem } = verifyOfflineQrToken({
          qrToken: rawToken,
          eventId: selectedEventId,
          gateId: selectedGateId,
          staffName,
          cachedTickets,
          existingQueue: offlineQueue,
        });

        if (queueItem) {
          setOfflineQueue((prev) =>
            [queueItem, ...prev].slice(0, MAX_OFFLINE_QUEUE_SIZE),
          );
        }
        triggerScanFeedback(response.color, { soundEnabled });
        setScanResult(response);
        setScanHistory((prev) => [response, ...prev.slice(0, 9)]);
        return;
      }

      try {
        const res = await fetch("/api/v1/checkin/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            qrToken: rawToken,
            gateId: selectedGateId,
            eventId: selectedEventId,
            staffName,
          }),
        });
        const json = await res.json();
        const data = json?.data as ScanCheckinResponse | undefined;
        if (data) {
          triggerScanFeedback(data.color, { soundEnabled });
          setScanResult(data);
          setScanHistory((prev) => [data, ...prev.slice(0, 9)]);
        }
      } catch {
        // Fallback to offline verification if network request fails unexpectedly
        setIsOfflineMode(true);
      }
    },
    [
      isOfflineMode,
      offlineQueue,
      selectedEventId,
      selectedGateId,
      soundEnabled,
      staffName,
    ],
  );

  // UC08 Main Flow: Continuous BarcodeDetector loop when camera is active
  useEffect(() => {
    if (!isCameraActive || typeof window === "undefined") return;
    const win = window as unknown as {
      BarcodeDetector?: new (opts: { formats: string[] }) => {
        detect: (
          video: HTMLVideoElement,
        ) => Promise<Array<{ rawValue?: string }>>;
      };
    };
    if (!win.BarcodeDetector) return;

    let active = true;
    const detector = new win.BarcodeDetector({ formats: ["qr_code"] });
    const interval = setInterval(async () => {
      if (!active || !videoRef.current || videoRef.current.readyState < 2) {
        return;
      }
      try {
        const barcodes = await detector.detect(videoRef.current);
        const firstValue = barcodes[0]?.rawValue;
        if (firstValue) {
          setQrInputText(firstValue);
          await executeQrScan(firstValue);
        }
      } catch {
        // Ignore frame detection error
      }
    }, 900);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isCameraActive, executeQrScan]);

  const handleSimulateValidScan = async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const uniqueSuffix = String((nowSec % 899) + 100);
    const dynamicId = `tkt-live-${uniqueSuffix}`;
    const issued = issueDynamicQrToken(
      {
        id: dynamicId,
        ticketCode: `TKT-VN-88${uniqueSuffix}-V01`,
        orderCode: "ORD-88412",
        eventId: selectedEventId,
        zoneName: "VIP BẠC",
        rowLabel: "Hàng 12",
        seatNumbers: "H12-05, H12-06",
      },
      nowSec,
    );
    setQrInputText(issued.qrToken);
    await executeQrScan(issued.qrToken);
  };

  const handleSimulateDuplicateScan = async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const issued = issueDynamicQrToken(
      {
        id: "tkt-order-77291",
        ticketCode: "TKT-VN-77291-A08",
        orderCode: "ORD-77291",
        eventId: selectedEventId,
        zoneName: "Khán đài A (Tầng 2)",
        rowLabel: "Hàng 08",
        seatNumbers: "A8-14",
      },
      nowSec,
    );
    setQrInputText(issued.qrToken);
    await executeQrScan(issued.qrToken);
  };

  const handleSimulateExpiredScan = async () => {
    const pastSec = Math.floor(Date.now() / 1000) - 90;
    const issued = issueDynamicQrToken(
      {
        id: "tkt-order-88415",
        ticketCode: "TKT-VN-88415-F02",
        orderCode: "ORD-88415",
        eventId: selectedEventId,
        zoneName: "FLOOR A",
        rowLabel: "Khu Fanzone",
        seatNumbers: "FZ-18",
      },
      pastSec,
    );
    setQrInputText(issued.qrToken);
    await executeQrScan(issued.qrToken);
  };

  const handleSimulateInvalidOrCancelledScan = async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const issued = issueDynamicQrToken(
      {
        id: "tkt-order-65103",
        ticketCode: "TKT-VN-65103-C03",
        orderCode: "ORD-65103",
        eventId: selectedEventId,
        zoneName: "Khu Phổ Thông CAT 2",
        rowLabel: "Tự do",
        seatNumbers: "GA-103, GA-104",
      },
      nowSec,
    );
    setQrInputText(issued.qrToken);
    await executeQrScan(issued.qrToken);
  };

  const handleManualSearch = async (queryOverride?: string) => {
    const q = queryOverride !== undefined ? queryOverride : searchQuery;
    try {
      const res = await fetch("/api/v1/checkin/manual-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEventId,
          searchQuery: q,
        }),
      });
      const json = await res.json();
      if (json?.data?.tickets) {
        setManualResults(json.data.tickets);
      }
    } catch {
      // ignore
    }
  };

  const handleManualCheckIn = async (ticket: GateTicketRecord) => {
    try {
      const res = await fetch("/api/v1/checkin/manual-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkin",
          ticketId: ticket.id,
          eventId: selectedEventId,
          gateId: selectedGateId,
          staffName,
        }),
      });
      const json = await res.json();
      if (json?.data) {
        const result = json.data as ScanCheckinResponse;
        triggerScanFeedback(result.color, { soundEnabled });
        setScanResult(result);
        setScanHistory((prev) => [result, ...prev.slice(0, 9)]);
        await handleManualSearch();
      }
    } catch {
      // ignore
    }
  };

  const handleSyncOfflineQueue = useCallback(async () => {
    if (offlineQueue.length === 0) return;
    setIsSyncing(true);
    try {
      const res = await fetch("/api/v1/checkin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queue: offlineQueue }),
      });
      const json = await res.json();
      if (json?.data?.results) {
        setSyncResults(json.data.results);
        setOfflineQueue([]);
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("tickethub_offline_queue");
        }
        triggerScanFeedback("GREEN", { soundEnabled });
      }
    } finally {
      setIsSyncing(false);
    }
  }, [offlineQueue, soundEnabled]);

  // UC08-E5: Listen to browser online/offline events & auto-sync when online returns
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOffline = () => setIsOfflineMode(true);
    const onOnline = () => {
      setIsOfflineMode(false);
      if (offlineQueue.length > 0) {
        void handleSyncOfflineQueue();
      }
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [offlineQueue.length, handleSyncOfflineQueue]);

  const validCount = scanHistory.filter((s) => s.status === "VALID").length;
  const rejectedCount = scanHistory.filter((s) => s.status !== "VALID").length;

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* 1. Header: Calm & task-oriented */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Soát vé tại cổng
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Quét mã QR động hoặc tra cứu thông tin khách hàng để xác nhận vào
            cổng.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setSoundEnabled((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] border text-[13px] transition-colors cursor-pointer ${
              soundEnabled
                ? "border-border bg-background text-foreground font-medium hover:bg-muted"
                : "border-border bg-muted text-muted-foreground font-medium"
            }`}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="size-3.5 text-primary" />
                <span>Âm báo: Bật</span>
              </>
            ) : (
              <>
                <VolumeX className="size-3.5" />
                <span>Âm báo: Tắt</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsOfflineMode((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] border text-[13px] transition-colors cursor-pointer ${
              isOfflineMode
                ? "border-amber-400 bg-amber-50 text-amber-900 font-semibold"
                : "border-border bg-background text-foreground font-medium hover:bg-muted"
            }`}
          >
            {isOfflineMode ? (
              <>
                <WifiOff className="size-3.5 text-amber-600" />
                <span>Ngoại tuyến</span>
              </>
            ) : (
              <>
                <Wifi className="size-3.5 text-primary" />
                <span>Trực tuyến</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Event & Gate Selector Bar + Compact Summary Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <div className="lg:col-span-7 rounded-lg border border-border bg-background p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="gate-event-select"
              className="block text-xs font-medium text-muted-foreground mb-1.5"
            >
              Sự kiện
            </label>
            <select
              id="gate-event-select"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full h-9 rounded-[8px] border border-border bg-background px-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-primary"
            >
              {EVENTS.slice(0, 5).map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="gate-id-select"
              className="block text-xs font-medium text-muted-foreground mb-1.5"
            >
              Vị trí cổng
            </label>
            <select
              id="gate-id-select"
              value={selectedGateId}
              onChange={(e) => setSelectedGateId(e.target.value)}
              className="w-full h-9 rounded-[8px] border border-border bg-background px-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-primary"
            >
              {GATES.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="lg:col-span-5 grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg border border-border bg-background flex flex-col justify-between">
            <span className="text-xs text-muted-foreground font-medium">
              Hợp lệ
            </span>
            <span className="text-lg font-bold tracking-tight text-primary mt-1 tabular-nums">
              {validCount}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Đã vào cổng
            </span>
          </div>

          <div className="p-3 rounded-lg border border-border bg-background flex flex-col justify-between">
            <span className="text-xs text-muted-foreground font-medium">
              Từ chối
            </span>
            <span className="text-lg font-bold tracking-tight text-destructive mt-1 tabular-nums">
              {rejectedCount}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Trùng / Hết hạn
            </span>
          </div>

          <div className="p-3 rounded-lg border border-border bg-background flex flex-col justify-between">
            <span className="text-xs text-muted-foreground font-medium">
              Hàng đợi
            </span>
            <span className="text-lg font-bold tracking-tight text-foreground mt-1 tabular-nums">
              {offlineQueue.length}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Chờ đồng bộ
            </span>
          </div>
        </div>
      </div>

      {/* 3. Filter / Mode Navigation Bar */}
      <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto">
        {[
          { key: "SCAN", label: "Quét mã QR", icon: Camera },
          { key: "MANUAL", label: "Tra cứu thủ công", icon: Search },
          {
            key: "OFFLINE",
            label: `Đồng bộ ngoại tuyến (${offlineQueue.length})`,
            icon: WifiOff,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() =>
                setActiveTab(tab.key as "SCAN" | "MANUAL" | "OFFLINE")
              }
              className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-[8px] text-[13px] transition-colors whitespace-nowrap cursor-pointer ${
                active
                  ? "border-[1.5px] border-primary bg-emerald-50/50 text-primary font-semibold"
                  : "border border-border bg-background text-foreground font-medium hover:bg-muted"
              }`}
            >
              <Icon className="size-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 4. Scan Result Status Banner (Green / Red / Yellow) */}
      {scanResult && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-lg border p-4 transition-all ${
            scanResult.color === "GREEN"
              ? "bg-emerald-50/70 border-emerald-500 text-emerald-950"
              : scanResult.color === "YELLOW"
                ? "bg-amber-50/80 border-amber-500 text-amber-950"
                : "bg-destructive/10 border-destructive text-foreground"
          }`}
        >
          <div className="flex items-start gap-3.5">
            <div
              className={`size-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                scanResult.color === "GREEN"
                  ? "bg-primary text-primary-foreground"
                  : scanResult.color === "YELLOW"
                    ? "bg-amber-500 text-white"
                    : "bg-destructive text-white"
              }`}
            >
              {scanResult.color === "GREEN" ? (
                <CheckCircle2 className="size-5" />
              ) : scanResult.color === "YELLOW" ? (
                <AlertTriangle className="size-5" />
              ) : (
                <XCircle className="size-5" />
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-[6px] text-xs font-semibold ${
                      scanResult.color === "GREEN"
                        ? "bg-primary text-primary-foreground"
                        : scanResult.color === "YELLOW"
                          ? "bg-amber-500 text-white"
                          : "bg-destructive text-white"
                    }`}
                  >
                    {scanResult.status === "VALID"
                      ? "Vé hợp lệ"
                      : scanResult.status === "ALREADY_USED"
                        ? "Vé đã sử dụng"
                        : scanResult.status === "EXPIRED"
                          ? "Mã QR hết hạn"
                          : "Từ chối vào cổng"}
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    {scanResult.message}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setScanResult(null)}
                  className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Đóng
                </button>
              </div>

              {scanResult.ticketCode && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border/60 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Mã vé</span>
                    <span className="font-mono font-semibold text-foreground">
                      {scanResult.ticketCode}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Khu vực</span>
                    <span className="font-semibold text-foreground">
                      {scanResult.zoneName || "VIP BẠC"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">
                      Hàng / Ghế
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {scanResult.rowLabel || "Hàng 12"} •{" "}
                      {scanResult.seatNumbers || "H12-05"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">
                      Người mua
                    </span>
                    <span className="font-semibold text-foreground">
                      {scanResult.holderName || "Trần Phú An"}
                    </span>
                  </div>
                </div>
              )}

              {scanResult.status === "ALREADY_USED" &&
                scanResult.previousGateId && (
                  <div className="inline-flex items-center gap-1.5 text-xs text-destructive font-medium pt-0.5">
                    <Clock className="size-3.5" />
                    <span>
                      Đã soát trước đó tại {scanResult.previousGateId} lúc{" "}
                      {scanResult.previousCheckedInAt
                        ? new Date(
                            scanResult.previousCheckedInAt,
                          ).toLocaleTimeString("vi-VN")
                        : "18:05:12"}
                    </span>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB 1: QR SCANNER & AUDIT TABLE */}
      {activeTab === "SCAN" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Camera & Input (7 cols) */}
          <div className="lg:col-span-7 rounded-lg border border-border bg-background p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Khung quét mã QR
                </h2>
                <p className="text-xs text-muted-foreground">
                  Đưa mã QR trên ứng dụng của khách vào vùng nhận diện.
                </p>
              </div>
              {isCameraActive ? (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] border border-border bg-background hover:bg-muted text-foreground text-xs font-medium cursor-pointer"
                >
                  <CameraOff className="size-3.5" />
                  <span>Tắt camera</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startCamera}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-primary hover:bg-emerald-700 text-primary-foreground text-xs font-semibold cursor-pointer"
                >
                  <Camera className="size-3.5" />
                  <span>Bật camera</span>
                </button>
              )}
            </div>

            {/* Camera Viewfinder */}
            <div className="relative aspect-[16/9] rounded-lg bg-muted border border-border overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${
                  isCameraActive ? "block" : "hidden"
                }`}
              />
              {!isCameraActive && (
                <div className="text-center p-6 space-y-2 max-w-sm">
                  <div className="size-10 rounded-full bg-background border border-border flex items-center justify-center mx-auto text-muted-foreground">
                    <QrCode className="size-5" />
                  </div>
                  <p className="text-xs font-medium text-foreground">
                    Camera đang tắt ({selectedGateId})
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {cameraError ||
                      "Nhấn 'Bật camera' để quét trực tiếp hoặc sử dụng ô nhập mã bên dưới."}
                  </p>
                </div>
              )}

              {isCameraActive && (
                <div className="pointer-events-none absolute inset-8 border border-primary/80 rounded-lg" />
              )}
            </div>

            {/* Manual Token Input */}
            <div className="space-y-1.5 pt-1">
              <label
                htmlFor="qr-token-input"
                className="block text-xs font-medium text-muted-foreground"
              >
                Mã chuỗi QR từ đầu đọc cầm tay
              </label>
              <div className="flex gap-2">
                <input
                  id="qr-token-input"
                  type="text"
                  value={qrInputText}
                  onChange={(e) => setQrInputText(e.target.value)}
                  placeholder="Dán nội dung token QR cần kiểm tra..."
                  className="flex-1 h-9 rounded-[8px] border border-border bg-background px-3 text-xs font-mono text-foreground placeholder:font-sans placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => executeQrScan(qrInputText)}
                  className="h-9 px-4 rounded-[8px] bg-primary hover:bg-emerald-700 text-primary-foreground text-xs font-semibold shrink-0 cursor-pointer"
                >
                  Kiểm tra
                </button>
              </div>
            </div>

            {/* Subtle Quick Sample Bar for testing without hardware camera */}
            <div className="pt-3 border-t border-border space-y-2">
              <span className="block text-xs font-medium text-muted-foreground">
                Chọn nhanh mẫu vé kiểm thử:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={handleSimulateValidScan}
                  className="h-8 px-2.5 rounded-[8px] border border-border bg-background hover:bg-muted text-foreground text-xs font-medium text-left truncate cursor-pointer flex items-center gap-1.5"
                >
                  <span className="size-2 rounded-full bg-primary shrink-0" />
                  <span className="truncate">Vé hợp lệ</span>
                </button>

                <button
                  type="button"
                  onClick={handleSimulateDuplicateScan}
                  className="h-8 px-2.5 rounded-[8px] border border-border bg-background hover:bg-muted text-foreground text-xs font-medium text-left truncate cursor-pointer flex items-center gap-1.5"
                >
                  <span className="size-2 rounded-full bg-destructive shrink-0" />
                  <span className="truncate">Vé quét trùng</span>
                </button>

                <button
                  type="button"
                  onClick={handleSimulateExpiredScan}
                  className="h-8 px-2.5 rounded-[8px] border border-border bg-background hover:bg-muted text-foreground text-xs font-medium text-left truncate cursor-pointer flex items-center gap-1.5"
                >
                  <span className="size-2 rounded-full bg-amber-500 shrink-0" />
                  <span className="truncate">QR quá hạn 30s</span>
                </button>

                <button
                  type="button"
                  onClick={handleSimulateInvalidOrCancelledScan}
                  className="h-8 px-2.5 rounded-[8px] border border-border bg-background hover:bg-muted text-foreground text-xs font-medium text-left truncate cursor-pointer flex items-center gap-1.5"
                >
                  <span className="size-2 rounded-full bg-muted-foreground shrink-0" />
                  <span className="truncate">Vé đã hủy</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right: Recent Scan Log (5 cols) */}
          <div className="lg:col-span-5 rounded-lg border border-border bg-background p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Lịch sử soát vé gần đây
                </h2>
                <p className="text-xs text-muted-foreground">
                  Ghi nhận tại {selectedGateId}
                </p>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {scanHistory.length} lượt
              </span>
            </div>

            {scanHistory.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                Chưa có lượt quét nào trong ca trực này.
              </div>
            ) : (
              <div className="divide-y divide-border border-t border-border">
                {scanHistory.map((item, idx) => (
                  <div
                    key={`${item.ticketCode || "scan"}-${idx}`}
                    className="py-3 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-foreground">
                          {item.ticketCode || "Không rõ mã"}
                        </span>
                        {item.holderName && (
                          <span className="text-muted-foreground truncate">
                            • {item.holderName}
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground line-clamp-1">
                        {item.message}
                      </p>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-[6px] text-[11px] font-medium shrink-0 ${
                        item.color === "GREEN"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : item.color === "YELLOW"
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {item.status === "VALID"
                        ? "Hợp lệ"
                        : item.status === "ALREADY_USED"
                          ? "Đã dùng"
                          : item.status === "EXPIRED"
                            ? "Hết hạn"
                            : "Từ chối"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. TAB 2: MANUAL LOOKUP TABLE */}
      {activeTab === "MANUAL" && (
        <div className="rounded-lg border border-border bg-background p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Tra cứu vé theo thông tin khách hàng
              </h2>
              <p className="text-xs text-muted-foreground">
                Sử dụng khi điện thoại của khách hết pin hoặc không hiển thị
                được mã QR. Cần đối chiếu CCCD trước khi xác nhận.
              </p>
            </div>

            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  void handleManualSearch(e.target.value);
                }}
                placeholder="Tìm theo SĐT, CCCD, email, tên hoặc mã vé..."
                className="w-full h-9 pl-9 pr-8 rounded-[8px] border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    void handleManualSearch("");
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã vé / Đơn hàng</TableHead>
                <TableHead>Khách hàng / CCCD</TableHead>
                <TableHead>Vị trí ghế</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {manualResults.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="font-mono text-xs font-semibold text-foreground">
                      {t.ticketCode}
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      #{t.orderCode}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-medium text-foreground">
                      {t.recipientName}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      SĐT: {t.recipientPhone} • CCCD:{" "}
                      <span className="font-mono">{t.recipientCccd}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-medium text-foreground">
                      {t.zoneName}
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {t.rowLabel} • {t.seatNumbers}
                    </div>
                  </TableCell>
                  <TableCell>
                    {t.status === "VALID" && (
                      <span className="inline-flex px-2 py-0.5 rounded-[6px] bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium">
                        Chưa sử dụng
                      </span>
                    )}
                    {t.status === "CHECKED_IN" && (
                      <span className="inline-flex px-2 py-0.5 rounded-[6px] bg-muted text-muted-foreground border border-border text-[11px] font-medium">
                        Đã vào ({t.checkedInGate || "GATE-A1"})
                      </span>
                    )}
                    {t.status === "CANCELLED" && (
                      <span className="inline-flex px-2 py-0.5 rounded-[6px] bg-destructive/10 text-destructive text-[11px] font-medium">
                        Đã hủy
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {t.status === "VALID" ? (
                      <button
                        type="button"
                        onClick={() => handleManualCheckIn(t)}
                        className="h-8 px-3 rounded-[8px] bg-primary hover:bg-emerald-700 text-primary-foreground text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Xác nhận vào cổng
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Không khả dụng
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 7. TAB 3: OFFLINE QUEUE & RECONCILIATION */}
      {activeTab === "OFFLINE" && (
        <div className="rounded-lg border border-border bg-background p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Hàng đợi soát vé ngoại tuyến
              </h2>
              <p className="text-xs text-muted-foreground">
                Các lượt quét khi mất mạng được lưu tạm trên thiết bị và đối
                soát xung đột khi có kết nối trở lại.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSyncOfflineQueue}
              disabled={isSyncing || offlineQueue.length === 0}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] bg-primary hover:bg-emerald-700 disabled:opacity-50 text-primary-foreground text-xs font-semibold transition-colors shrink-0 cursor-pointer"
            >
              <RefreshCw
                className={`size-3.5 ${isSyncing ? "animate-spin" : ""}`}
              />
              <span>Đồng bộ lên máy chủ ({offlineQueue.length})</span>
            </button>
          </div>

          {offlineQueue.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
              Không có lượt soát vé nào đang chờ đồng bộ.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã vé</TableHead>
                  <TableHead>Cổng ghi nhận</TableHead>
                  <TableHead>Thời điểm quét</TableHead>
                  <TableHead>Nhân viên</TableHead>
                  <TableHead className="text-right">Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offlineQueue.map((item) => (
                  <TableRow key={item.queueId}>
                    <TableCell className="font-mono text-xs font-semibold">
                      {item.ticketCode}
                    </TableCell>
                    <TableCell className="text-xs">{item.gateId}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(item.scannedAt).toLocaleTimeString("vi-VN")}
                    </TableCell>
                    <TableCell className="text-xs">{item.staffName}</TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex px-2 py-0.5 rounded-[6px] bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-medium">
                        Chờ đồng bộ
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {syncResults.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-border">
              <h3 className="text-xs font-semibold text-muted-foreground">
                Kết quả đối soát gần nhất
              </h3>
              <div className="divide-y divide-border border rounded-lg border-border">
                {syncResults.map((r) => (
                  <div
                    key={r.queueId}
                    className="p-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {r.syncStatus === "SYNCED" ? (
                        <Check className="size-4 text-primary shrink-0" />
                      ) : (
                        <AlertTriangle className="size-4 text-destructive shrink-0" />
                      )}
                      <div className="min-w-0">
                        <span className="font-mono font-semibold text-foreground mr-2">
                          {r.ticketCode}
                        </span>
                        <span className="text-muted-foreground">
                          {r.message}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-[6px] text-[11px] font-medium shrink-0 ${
                        r.syncStatus === "SYNCED"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {r.syncStatus === "SYNCED"
                        ? "Đã đồng bộ"
                        : r.syncStatus === "CONFLICT"
                          ? "Trùng cổng"
                          : "Từ chối"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
