import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  DYNAMIC_QR_TTL_SECONDS,
  MAX_OFFLINE_QUEUE_SIZE,
  issueDynamicQrToken,
  verifyAndScanQrToken,
  verifyOfflineQrToken,
  manualSearchTickets,
  manualCheckInTicket,
  syncOfflineCheckinQueue,
  resetCheckinStore,
} from "../src/lib/checkin-engine.ts";

describe("W05-FE2 & W06-FE2 (Tuần 4): QR Động 30s, App Soát Vé PWA & Đồng Bộ Offline (UC05, UC08)", () => {
  const EVENT_ID = "evt-anh-trai-vuot-ngan-chong-gai";

  beforeEach(() => {
    resetCheckinStore();
  });

  describe("1. Token QR Động Ed25519 30s (UC05)", () => {
    it("TC-W4-01: Cấp token QR động có hạn đúng 30 giây kèm chữ ký số Ed25519 và jti duy nhất", () => {
      const nowSec = 1762000000;
      const issued = issueDynamicQrToken(
        {
          id: "tkt-order-88412",
          ticketCode: "TKT-VN-88412-V01",
          orderCode: "ORD-88412",
          eventId: EVENT_ID,
          zoneName: "VIP BẠC",
          rowLabel: "Hàng 12",
          seatNumbers: "H12-05, H12-06",
        },
        nowSec,
      );

      assert.equal(issued.ttlSeconds, 30);
      assert.equal(DYNAMIC_QR_TTL_SECONDS, 30);
      assert.equal(issued.payload.exp - issued.payload.iat, 30);
      assert.ok(issued.payload.sig.startsWith("ed25519_"));
      assert.ok(issued.payload.jti.length > 8);
    });
  });

  describe("2. Soát vé QR nguyên tử tại cổng & 3 màu phản hồi (UC08 Main & E1-E3)", () => {
    it("TC-W4-02: Quét mã QR hợp lệ lần đầu -> Trả về VALID (Màn hình XANH) và thông tin ghế", () => {
      const nowSec = 1762000000;
      const issued = issueDynamicQrToken(
        {
          id: "tkt-order-88412",
          ticketCode: "TKT-VN-88412-V01",
          orderCode: "ORD-88412",
          eventId: EVENT_ID,
          zoneName: "VIP BẠC",
          rowLabel: "Hàng 12",
          seatNumbers: "H12-05, H12-06",
        },
        nowSec,
      );

      const scanRes = verifyAndScanQrToken({
        qrToken: issued.qrToken,
        eventId: EVENT_ID,
        gateId: "GATE-B2",
        staffName: "Trần Phú An",
        nowEpochSec: nowSec + 10,
      });

      assert.equal(scanRes.status, "VALID");
      assert.equal(scanRes.color, "GREEN");
      assert.equal(scanRes.ticketCode, "TKT-VN-88412-V01");
      assert.equal(scanRes.zoneName, "VIP BẠC");
      assert.equal(scanRes.seatNumbers, "H12-05, H12-06");
      assert.equal(scanRes.gateId, "GATE-B2");
    });

    it("TC-W4-03 (UC08-E1): Chống quét trùng giữa 2 cổng -> Lần quét thứ 2 trả về ALREADY_USED (Màn hình ĐỎ)", () => {
      const nowSec = 1762000000;
      const issued = issueDynamicQrToken(
        {
          id: "tkt-order-88412",
          ticketCode: "TKT-VN-88412-V01",
          orderCode: "ORD-88412",
          eventId: EVENT_ID,
          zoneName: "VIP BẠC",
          rowLabel: "Hàng 12",
          seatNumbers: "H12-05, H12-06",
        },
        nowSec,
      );

      // Cổng A1 quét trước
      const firstScan = verifyAndScanQrToken({
        qrToken: issued.qrToken,
        eventId: EVENT_ID,
        gateId: "GATE-A1",
        nowEpochSec: nowSec + 5,
      });
      assert.equal(firstScan.status, "VALID");

      // Cổng B2 quét cùng vé đó ngay sau đó
      const secondScan = verifyAndScanQrToken({
        qrToken: issued.qrToken,
        eventId: EVENT_ID,
        gateId: "GATE-B2",
        nowEpochSec: nowSec + 6,
      });
      assert.equal(secondScan.status, "ALREADY_USED");
      assert.equal(secondScan.color, "RED");
      assert.equal(secondScan.previousGateId, "GATE-A1");
      assert.ok(secondScan.previousCheckedInAt);
    });

    it("TC-W4-04 (UC08-E3): Mã QR quá hạn 30 giây hoặc ảnh chụp màn hình cũ -> Trả về EXPIRED (Màn hình VÀNG)", () => {
      const nowSec = 1762000000;
      const issued = issueDynamicQrToken(
        {
          id: "tkt-order-88415",
          ticketCode: "TKT-VN-88415-F02",
          orderCode: "ORD-88415",
          eventId: EVENT_ID,
          zoneName: "FLOOR A",
          rowLabel: "Khu Fanzone",
          seatNumbers: "FZ-18",
        },
        nowSec,
      );

      // Quét sau 45 giây (quá hạn 30s + 5s dung sai)
      const expiredScan = verifyAndScanQrToken({
        qrToken: issued.qrToken,
        eventId: EVENT_ID,
        gateId: "GATE-A1",
        nowEpochSec: nowSec + 45,
      });

      assert.equal(expiredScan.status, "EXPIRED");
      assert.equal(expiredScan.color, "YELLOW");
    });

    it("TC-W4-05 (UC08-E2): Từ chối vé đã hủy (CANCELLED), sai sự kiện hoặc chữ ký giả mạo (Màn hình ĐỎ)", () => {
      const nowSec = 1762000000;

      // 1. Vé đã hủy (tkt-order-65103)
      const cancelledQr = issueDynamicQrToken(
        {
          id: "tkt-order-65103",
          ticketCode: "TKT-VN-65103-C03",
          orderCode: "ORD-65103",
          eventId: EVENT_ID,
          zoneName: "CAT 2",
          rowLabel: "Tự do",
          seatNumbers: "GA-103",
        },
        nowSec,
      );
      const resCancelled = verifyAndScanQrToken({
        qrToken: cancelledQr.qrToken,
        eventId: EVENT_ID,
        gateId: "GATE-C1",
        nowEpochSec: nowSec + 5,
      });
      assert.equal(resCancelled.status, "INVALID");
      assert.equal(resCancelled.color, "RED");
      assert.equal(resCancelled.reasonCode, "TICKET_CANCELLED");

      // 2. Vé sai sự kiện
      const wrongEventRes = verifyAndScanQrToken({
        qrToken: cancelledQr.qrToken,
        eventId: "evt-other-event",
        gateId: "GATE-C1",
        nowEpochSec: nowSec + 5,
      });
      assert.equal(wrongEventRes.status, "INVALID");
      assert.equal(wrongEventRes.reasonCode, "WRONG_EVENT");

      // 3. Chữ ký giả mạo hoặc bị xóa trường sig
      const tamperedPayload = {
        ...cancelledQr.payload,
        sig: "ed25519_tampered000000",
      };
      const tamperedRes = verifyAndScanQrToken({
        qrToken: JSON.stringify(tamperedPayload),
        eventId: EVENT_ID,
        gateId: "GATE-C1",
        nowEpochSec: nowSec + 5,
      });
      assert.equal(tamperedRes.status, "INVALID");
      assert.equal(tamperedRes.reasonCode, "INVALID_SIGNATURE");

      const strippedSigPayload = {
        ...cancelledQr.payload,
        sig: "",
      };
      const strippedSigRes = verifyAndScanQrToken({
        qrToken: JSON.stringify(strippedSigPayload),
        eventId: EVENT_ID,
        gateId: "GATE-C1",
        nowEpochSec: nowSec + 5,
      });
      assert.equal(strippedSigRes.status, "INVALID");
      assert.equal(strippedSigRes.reasonCode, "INVALID_SIGNATURE");
    });
  });

  describe("3. Tra cứu thủ công & Đồng bộ Offline PWA (UC08-E5, E6)", () => {
    it("TC-W4-06 (UC08-E6): Tra cứu thủ công theo SĐT/CCCD/ticketCode và xác nhận check-in kèm tên nhân viên", () => {
      const matches = manualSearchTickets({
        eventId: EVENT_ID,
        searchQuery: "0987654321",
      });
      assert.equal(matches.length, 1);
      assert.equal(matches[0].ticketCode, "TKT-VN-88415-F02");

      const cccdMatches = manualSearchTickets({
        eventId: EVENT_ID,
        searchQuery: "079204008812",
      });
      assert.equal(cccdMatches.length, 1);
      assert.equal(cccdMatches[0].ticketCode, "TKT-VN-88412-V01");

      const checkInRes = manualCheckInTicket({
        ticketId: matches[0].id,
        eventId: EVENT_ID,
        gateId: "GATE-A1",
        staffName: "Trần Phú An (Gate Staff)",
      });
      assert.equal(checkInRes.status, "VALID");
      assert.equal(checkInRes.color, "GREEN");
    });

    it("TC-W4-07 (UC08-E5): Xác thực QR ngoại tuyến (Ed25519 + giới hạn 500 lượt) & đồng bộ xung đột đa cổng", () => {
      const nowSec = 1762000000;
      const validIssued = issueDynamicQrToken(
        {
          id: "tkt-order-88412",
          ticketCode: "TKT-VN-88412-V01",
          orderCode: "ORD-88412",
          eventId: EVENT_ID,
          zoneName: "VIP BẠC",
          rowLabel: "Hàng 12",
          seatNumbers: "H12-05, H12-06",
        },
        nowSec,
      );

      const offlineCheck = verifyOfflineQrToken({
        qrToken: validIssued.qrToken,
        eventId: EVENT_ID,
        gateId: "GATE-B2",
        nowEpochSec: nowSec + 5,
      });
      assert.equal(offlineCheck.response.status, "VALID");
      assert.ok(offlineCheck.queueItem);
      assert.equal(MAX_OFFLINE_QUEUE_SIZE, 500);

      const results = syncOfflineCheckinQueue([
        {
          queueId: "off-1",
          ticketId: "tkt-order-88419",
          ticketCode: "TKT-VN-88419-V09",
          eventId: EVENT_ID,
          gateId: "GATE-VIP",
          staffName: "Nhân viên Cổng VIP",
          scannedAt: "2026-11-01T18:10:00.000Z",
          qrToken: "{}",
        },
        {
          queueId: "off-2",
          ticketId: "tkt-order-77291", // Vé này đã CHECKED_IN ở GATE-A1 trước đó
          ticketCode: "TKT-VN-77291-A08",
          eventId: EVENT_ID,
          gateId: "GATE-B2",
          staffName: "Nhân viên Cổng B2",
          scannedAt: "2026-11-01T18:12:00.000Z",
          qrToken: "{}",
        },
      ]);

      assert.equal(results.length, 2);
      assert.equal(results[0].syncStatus, "SYNCED");
      assert.equal(results[1].syncStatus, "CONFLICT");
      assert.equal(results[1].conflictGateId, "GATE-A1");
    });
  });
});
