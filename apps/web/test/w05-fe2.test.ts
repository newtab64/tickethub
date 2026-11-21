import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GateLookupRequestSchema,
  GateScanRequestSchema,
  GetTicketQrResponseSchema,
} from "@tickethub/shared";
import {
  GATE_OPTIONS,
  classifyScanVerdict,
  extractQrTokenFromInput,
  isValidLast4Digits,
  verdictHeadline,
} from "../src/features/gate/domain/gate-rules.ts";

describe("W05-FE2: Ung dung soat ve tai cong (/gate/scanner) va ma QR dong 30s (UC05, UC08)", () => {
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

  describe("2. Phan loai trang thai soat ve va tra cuu thu cong (gate-rules)", () => {
    it("Phan loai dung 4 trang thai VALID, DUPLICATE, EXPIRED, INVALID", () => {
      assert.equal(classifyScanVerdict("VALID"), "VALID");
      assert.equal(
        classifyScanVerdict(undefined, "ALREADY_CHECKED_IN"),
        "DUPLICATE",
      );
      assert.equal(classifyScanVerdict(undefined, "QR_EXPIRED"), "EXPIRED");
      assert.equal(
        classifyScanVerdict(undefined, "TICKET_NOT_FOUND"),
        "INVALID",
      );
      assert.ok(verdictHeadline("VALID").includes("hợp lệ"));
      assert.ok(GATE_OPTIONS.length >= 3);
    });

    it("Kiem tra dung 4 ky tu cuoi cua SDT hoac Email (isValidLast4Digits)", () => {
      assert.equal(isValidLast4Digits("6868"), true);
      assert.equal(isValidLast4Digits("ab12"), true);
      assert.equal(isValidLast4Digits("123"), false);
      assert.equal(isValidLast4Digits("12345"), false);
    });

    it("GateScanRequestSchema, GateLookupRequestSchema va GetTicketQrResponseSchema khop hop dong", () => {
      const scan = GateScanRequestSchema.safeParse({
        qrToken: "qr_live_token",
        gateId: GATE_OPTIONS[0]!.id,
      });
      assert.equal(scan.success, true);

      const lookup = GateLookupRequestSchema.safeParse({
        eventId: "a0000000-0000-4000-8000-000000000001",
        ticketCode: "TH-88412-01",
        phoneOrEmailLast4: "6868",
        gateId: GATE_OPTIONS[0]!.id,
        reason: "Dien thoai khach het pin tai cong",
      });
      assert.equal(lookup.success, true);

      const qr = GetTicketQrResponseSchema.safeParse({
        ticketId: "a0000000-0000-4000-8000-000000000010",
        qrToken: "qr_tok_live_123456",
        expiresAt: new Date(Date.now() + 30_000).toISOString(),
        remainingSeconds: 30,
      });
      assert.equal(qr.success, true);
    });
  });
});
