import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GateLookupRequestSchema,
  GateScanRequestSchema,
  GetTicketQrResponseSchema,
} from "@tickethub/shared";
import {
  extractQrTokenFromInput,
  isValidLast4Digits,
} from "../src/lib/sound-haptics.ts";

describe("W05-FE2: QR dong 30s trong Ve cua toi va Ung dung soat ve PWA (UC05, UC08)", () => {
  describe("1. Boc tach du lieu ma QR dong (extractQrTokenFromInput)", () => {
    it("Doc chinh xac JSON payload tu ma QR dong trong Ve cua toi", () => {
      const jsonQr = JSON.stringify({
        ticketId: "a0000000-0000-4000-8000-000000000010",
        ticketCode: "TH-982341-01",
        token: "qr_tok_live_123456",
        exp: Date.now() + 30000,
      });

      const parsed = extractQrTokenFromInput(jsonQr);
      assert.equal(parsed.qrToken, "qr_tok_live_123456");
      assert.equal(parsed.ticketCode, "TH-982341-01");
    });

    it("Chap nhan chuoi token thuan tu dau doc ma vach cam tay", () => {
      const parsed = extractQrTokenFromInput("  TH-982341-01  ");
      assert.equal(parsed.qrToken, "TH-982341-01");
    });

    it("Tra ve chuoi rong khi dau vao chi chua khoang trang", () => {
      const parsed = extractQrTokenFromInput("   ");
      assert.equal(parsed.qrToken, "");
    });
  });

  describe("2. Xac thuc tra cuu thu cong tai cong (UC08 Manual Lookup)", () => {
    it("Kiem tra dung 4 ky tu cuoi cua SDT hoac Email (isValidLast4Digits)", () => {
      assert.equal(isValidLast4Digits("6868"), true);
      assert.equal(isValidLast4Digits("ab12"), true);
      assert.equal(isValidLast4Digits("123"), false);
      assert.equal(isValidLast4Digits("12345"), false);
      assert.equal(isValidLast4Digits(""), false);
    });

    it("GateScanRequestSchema va GateLookupRequestSchema khop chuan API_CONTRACT", () => {
      const scanReq = GateScanRequestSchema.safeParse({
        qrToken: "qr_tok_live_123456",
        gateId: "11111111-1111-4111-8111-111111111101",
      });
      assert.equal(scanReq.success, true);

      const lookupReq = GateLookupRequestSchema.safeParse({
        eventId: "a0000000-0000-4000-8000-000000000001",
        ticketCode: "TH-982341-01",
        phoneOrEmailLast4: "6868",
        reason: "Khach hang bi het pin dien thoai tai cong A",
        gateId: "11111111-1111-4111-8111-111111111101",
      });
      assert.equal(lookupReq.success, true);
    });

    it("GetTicketQrResponseSchema dam bao chu ky QR dong 30 giay", () => {
      const qrRes = GetTicketQrResponseSchema.safeParse({
        ticketId: "a0000000-0000-4000-8000-000000000010",
        qrToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.signature",
        expiresAt: new Date(Date.now() + 30000).toISOString(),
        remainingSeconds: 30,
      });
      assert.equal(qrRes.success, true);
    });
  });
});
