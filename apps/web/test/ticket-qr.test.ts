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

  test("han tinh tu luc nhan, lam tron len va khong vuot qua han goc", () => {
    assert.equal(qrSecondsLeft(1000, 30, 1000), 30);
    assert.equal(qrSecondsLeft(1000, 30, 30_999), 1);
    assert.equal(qrSecondsLeft(1000, 30, 31_000), 0);
    assert.equal(qrSecondsLeft(1000, 30, 90_000), 0);
    // Dong ho may lui lai khong duoc keo dai ma.
    assert.equal(qrSecondsLeft(1000, 30, 0), 30);
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
