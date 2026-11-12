import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ApproveActionSchema,
  ConfirmImageSchema,
  PresignImageSchema,
  RejectActionSchema,
  ReviewEventSchema,
  ReviewOrganizerSchema,
} from "@tickethub/shared";

import {
  OrganizerReviewPayloadSchema,
  parseReviewPayload,
} from "../src/contexts/notification/domain/email.types";

describe("W02-BE2: Admin Review & Moderation Schemas (UC10)", () => {
  it("ReviewOrganizerSchema: chấp nhận APPROVE khi không có lý do", () => {
    const valid = ReviewOrganizerSchema.safeParse({
      decision: "APPROVE",
    });
    assert.equal(valid.success, true);
    if (valid.success) {
      assert.equal(valid.data.decision, "APPROVE");
      assert.equal(valid.data.version, undefined);
    }
  });

  it("ReviewOrganizerSchema: chấp nhận version số nguyên dương", () => {
    const valid = ReviewOrganizerSchema.safeParse({
      decision: "APPROVE",
      version: 2,
    });
    assert.equal(valid.success, true);
    if (valid.success) {
      assert.equal(valid.data.version, 2);
    }
  });

  it("ReviewOrganizerSchema: từ chối REJECT nếu thiếu lý do", () => {
    const invalid = ReviewOrganizerSchema.safeParse({
      decision: "REJECT",
    });
    assert.equal(invalid.success, false);
  });

  it("ReviewOrganizerSchema: chấp nhận REJECT khi có lý do hợp lệ", () => {
    const valid = ReviewOrganizerSchema.safeParse({
      decision: "REJECT",
      reason: "Giấy phép kinh doanh không khớp thông tin đăng ký",
      version: 1,
    });
    assert.equal(valid.success, true);
  });

  it("ReviewEventSchema: từ chối REJECT sự kiện nếu thiếu lý do", () => {
    const invalid = ReviewEventSchema.safeParse({
      decision: "REJECT",
    });
    assert.equal(invalid.success, false);
  });

  it("ApproveActionSchema: cho phép body rỗng hoặc version tùy chọn", () => {
    const empty = ApproveActionSchema.safeParse({});
    assert.equal(empty.success, true);

    const withVersion = ApproveActionSchema.safeParse({ version: 3 });
    assert.equal(withVersion.success, true);
    if (withVersion.success) {
      assert.equal(withVersion.data.version, 3);
    }
  });

  it("RejectActionSchema: bắt buộc phải có lý do từ chối", () => {
    const empty = RejectActionSchema.safeParse({});
    assert.equal(empty.success, false);

    const valid = RejectActionSchema.safeParse({
      reason: "Địa điểm tổ chức chưa có giấy phép PCCC",
    });
    assert.equal(valid.success, true);
  });
});

describe("W02-BE2: Upload Ảnh & Kiểm tra Magic Bytes S3 (UC10)", () => {
  it("PresignImageSchema: chấp nhận ảnh JPG, PNG và WebP dưới 5 MiB", () => {
    const validJpg = PresignImageSchema.safeParse({
      filename: "banner-event.jpg",
      contentType: "image/jpeg",
      sizeBytes: 2 * 1024 * 1024,
    });
    assert.equal(validJpg.success, true);

    const validPng = PresignImageSchema.safeParse({
      filename: "poster.png",
      contentType: "image/png",
      sizeBytes: 4 * 1024 * 1024,
    });
    assert.equal(validPng.success, true);

    const validWebp = PresignImageSchema.safeParse({
      filename: "stage-layout.webp",
      contentType: "image/webp",
      sizeBytes: 1024 * 1024,
    });
    assert.equal(validWebp.success, true);
  });

  it("PresignImageSchema: từ chối file vượt quá 5 MiB", () => {
    const oversized = PresignImageSchema.safeParse({
      filename: "huge-image.png",
      contentType: "image/png",
      sizeBytes: 5 * 1024 * 1024 + 1,
    });
    assert.equal(oversized.success, false);
  });

  it("PresignImageSchema: từ chối đuôi file không khớp Content-Type", () => {
    const mismatched = PresignImageSchema.safeParse({
      filename: "malicious-script.exe",
      contentType: "image/png",
      sizeBytes: 1024,
    });
    assert.equal(mismatched.success, false);
  });

  it("ConfirmImageSchema: kiểm tra định dạng object key", () => {
    const valid = ConfirmImageSchema.safeParse({
      key: "events/org-123/banner-abc.jpg",
    });
    assert.equal(valid.success, true);

    const empty = ConfirmImageSchema.safeParse({
      key: "",
    });
    assert.equal(empty.success, false);
  });

  it("Magic Bytes: xác thực đúng header của ảnh PNG chuẩn", () => {
    const pngHeader = Buffer.from([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13,
    ]);
    const expectedPngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
    const isPng = expectedPngSignature.every(
      (val, idx) => pngHeader[idx] === val,
    );
    assert.equal(isPng, true);

    // File giả mạo
    const fakePng = Buffer.from("<?php echo 'malicious'; ?>");
    const isFakePng = expectedPngSignature.every(
      (val, idx) => fakePng[idx] === val,
    );
    assert.equal(isFakePng, false);
  });

  it("Magic Bytes: xác thực đúng header của ảnh JPEG SOI chuẩn", () => {
    const jpegHeader = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    ]);
    const isJpeg =
      jpegHeader[0] === 0xff &&
      jpegHeader[1] === 0xd8 &&
      jpegHeader[2] === 0xff;
    assert.equal(isJpeg, true);
  });

  it("Magic Bytes: xác thực đúng header của ảnh WebP (RIFF....WEBP)", () => {
    const webpHeader = Buffer.concat([
      Buffer.from("RIFF"),
      Buffer.from([0x24, 0x00, 0x00, 0x00]),
      Buffer.from("WEBP"),
    ]);
    const isWebp =
      webpHeader.subarray(0, 4).toString("ascii") === "RIFF" &&
      webpHeader.subarray(8, 12).toString("ascii") === "WEBP";
    assert.equal(isWebp, true);
  });
});

describe("W02-BE2: Transactional Outbox & Email Payload Validation (UC10)", () => {
  const profileId = "11111111-1111-4111-8111-111111111111";
  const userId = "22222222-2222-4222-8222-222222222222";
  const eventId = "33333333-3333-4333-8333-333333333333";

  it("parseReviewPayload: phê duyệt Ban tổ chức thành công", () => {
    const payload = {
      profileId,
      userId,
      email: "btc@concert.vn",
      organizationName: "Công ty Âm nhạc Sài Gòn",
      decision: "APPROVE" as const,
      reason: null,
    };

    const parsed = parseReviewPayload("ORGANIZER_APPROVED", payload);
    assert.equal(parsed.userId, userId);
    assert.equal(parsed.email, "btc@concert.vn");
    assert.equal(parsed.decision, "APPROVE");
  });

  it("parseReviewPayload: từ chối Ban tổ chức kèm lý do", () => {
    const payload = {
      profileId,
      userId,
      email: "btc@concert.vn",
      organizationName: "Công ty Âm nhạc Sài Gòn",
      decision: "REJECT" as const,
      reason: "Mã số thuế không hợp lệ",
    };

    const parsed = parseReviewPayload("ORGANIZER_REJECTED", payload);
    assert.equal(parsed.decision, "REJECT");
    assert.equal(parsed.reason, "Mã số thuế không hợp lệ");
  });

  it("parseReviewPayload: phê duyệt sự kiện thành công", () => {
    const payload = {
      eventId,
      organizerId: profileId,
      userId,
      email: "btc@concert.vn",
      eventTitle: "Rock Fest Vietnam 2026",
      decision: "APPROVE" as const,
      reason: null,
    };

    const parsed = parseReviewPayload("EVENT_APPROVED", payload);
    assert.equal(parsed.decision, "APPROVE");
  });

  it("parseReviewPayload: từ chối sự kiện kèm lý do", () => {
    const payload = {
      eventId,
      organizerId: profileId,
      userId,
      email: "btc@concert.vn",
      eventTitle: "Rock Fest Vietnam 2026",
      decision: "REJECT" as const,
      reason: "Sơ đồ ghế thiếu lối thoát hiểm",
    };

    const parsed = parseReviewPayload("EVENT_REJECTED", payload);
    assert.equal(parsed.decision, "REJECT");
    assert.equal(parsed.reason, "Sơ đồ ghế thiếu lối thoát hiểm");
  });

  it("parseReviewPayload: phát hiện không khớp giữa decision và eventType", () => {
    const mismatchedPayload = {
      profileId,
      userId,
      email: "btc@concert.vn",
      organizationName: "Công ty Âm nhạc",
      decision: "REJECT" as const,
    };

    assert.throws(
      () => parseReviewPayload("ORGANIZER_APPROVED", mismatchedPayload),
      /Review decision does not match event type/,
    );
  });

  it("OrganizerReviewPayloadSchema: từ chối email null hoặc sai định dạng", () => {
    const invalidEmail = {
      profileId,
      userId,
      email: null,
      organizationName: "Công ty Âm nhạc",
      decision: "APPROVE",
    };

    const result = OrganizerReviewPayloadSchema.safeParse(invalidEmail);
    assert.equal(result.success, false);
  });
});
