import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  canShowQr,
  isQrRejection,
  qrSecondsLeft,
  qrView,
} from "../src/features/booking/domain/ticket-qr.ts";

describe("Ticket QR rules", () => {
  test("chi ve con hieu luc cua su kien dang mo moi co ma", () => {
    assert.equal(canShowQr({ status: "SOLD" }, "PUBLISHED"), true);
    assert.equal(canShowQr({ status: "CHECKED_IN" }, "PUBLISHED"), false);
    assert.equal(canShowQr({ status: "CANCELLED" }, "PUBLISHED"), false);
    assert.equal(canShowQr({ status: "SOLD" }, "SUSPENDED"), false);
  });

  const at = (wall: number, mono = wall) => ({ wall, mono });

  test("han tinh tu luc gui yeu cau, lam tron len va khong vuot han goc", () => {
    const left = (now: number) => qrSecondsLeft(at(1000), 30, at(now));
    assert.equal(left(1000), 30);
    assert.equal(left(30_999), 1);
    assert.equal(left(31_000), 0);
    assert.equal(left(90_000), 0);
    assert.equal(left(0), 30);
  });

  test("chinh dong ho khong keo dai ma, may ngu van tinh thoi gian", () => {
    const sent = at(1_000_000, 500);
    // Đồng hồ lùi 1 giờ nhưng đã trôi 40 giây thật.
    assert.equal(qrSecondsLeft(sent, 30, at(1_000_000 - 3_600_000, 40_500)), 0);
    // Máy ngủ: đồng hồ đơn điệu dừng lại, đồng hồ tường vẫn chạy.
    assert.equal(qrSecondsLeft(sent, 30, at(1_045_000, 600)), 0);
  });

  test("loi 4xx la tu choi, tru qua tai va het thoi gian cho", () => {
    for (const status of [400, 401, 403, 404, 409, 422]) {
      assert.equal(isQrRejection(status), true, String(status));
    }
    for (const status of [null, 0, 408, 429, 500, 503]) {
      assert.equal(isQrRejection(status), false, String(status));
    }
  });

  test("khong bao gio hien ma het han hoac ma cua ve bi tu choi", () => {
    const view = (
      hasToken: boolean,
      secondsLeft: number,
      errorStatus: number | null,
    ) => qrView({ hasToken, secondsLeft, errorStatus });
    assert.equal(view(true, 20, 409), "rejected");
    assert.equal(view(true, 3, 0), "soon");
    assert.equal(view(true, 0, 0), "offline");
    assert.equal(view(true, 0, 429), "offline");
    assert.equal(view(true, 0, null), "loading");
    assert.equal(view(false, 0, null), "loading");
    assert.equal(view(false, 0, 503), "offline");
    assert.equal(view(true, 6, null), "live");
    assert.equal(view(true, 5, null), "soon");
  });
});
