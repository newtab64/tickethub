import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

// Chỉ sử dụng thông tin giả cho Unit Test.
const TMN_CODE = "BE2UNITTEST";
const HASH_SECRET = "unit-test-only-not-a-real-vnpay-secret";
const RETURN_URL = "http://localhost:3000/checkout/vnpay-return";

async function createGateway() {
  process.env.VNPAY_TMN_CODE = TMN_CODE;
  process.env.VNPAY_HASH_SECRET = HASH_SECRET;
  process.env.VNPAY_RETURN_URL = RETURN_URL;
  process.env.VNPAY_URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";

  const { VnpayGateway } =
    await import("../src/contexts/payment/infrastructure/vnpay.gateway");

  return new VnpayGateway();
}

function signCallback(params: Record<string, string>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (
      key.startsWith("vnp_") &&
      key !== "vnp_SecureHash" &&
      key !== "vnp_SecureHashType"
    ) {
      query.append(key, value);
    }
  }

  query.sort();

  const hash = createHmac("sha512", HASH_SECRET)
    .update(query.toString(), "utf8")
    .digest("hex");

  return { ...params, vnp_SecureHash: hash };
}

test("VNPay creates a signed payment URL", async () => {
  const gateway = await createGateway();

  const result = await gateway.createPaymentUrl({
    transactionRef: "BE2TEST123",
    amountVnd: 150000,
    orderInfo: "TicketHub test payment",
    returnUrl: RETURN_URL,
    ipAddress: "127.0.0.1",
  });

  const url = new URL(result.paymentUrl);

  assert.equal(result.transactionRef, "BE2TEST123");
  assert.equal(url.searchParams.get("vnp_Amount"), "15000000");
  assert.equal(url.searchParams.get("vnp_TxnRef"), "BE2TEST123");
  assert.equal(url.searchParams.get("vnp_Version"), "2.1.0");
  assert.match(url.searchParams.get("vnp_SecureHash") ?? "", /^[0-9a-f]{128}$/);

  // Test IPv6 address
  const resultIpv6 = await gateway.createPaymentUrl({
    transactionRef: "BE2TESTIPV6",
    amountVnd: 150000,
    orderInfo: "TicketHub test payment IPv6",
    returnUrl: RETURN_URL,
    ipAddress: "::1",
  });
  assert.equal(resultIpv6.transactionRef, "BE2TESTIPV6");
});

test("VNPay rejects invalid payment amount", async () => {
  const gateway = await createGateway();

  await assert.rejects(
    gateway.createPaymentUrl({
      transactionRef: "BE2TEST123",
      amountVnd: -100,
      orderInfo: "Invalid test",
      returnUrl: RETURN_URL,
      ipAddress: "127.0.0.1",
    }),
    /Invalid payment amount/,
  );
});

test("VNPay rejects untrusted return URL", async () => {
  const gateway = await createGateway();

  await assert.rejects(
    gateway.createPaymentUrl({
      transactionRef: "BE2TEST123",
      amountVnd: 150000,
      orderInfo: "TicketHub test",
      returnUrl: "https://example.com/fake",
      ipAddress: "127.0.0.1",
    }),
    /Untrusted VNPay return URL/,
  );
});

test("VNPay accepts a valid signed callback", async () => {
  const gateway = await createGateway();

  const callback = signCallback({
    vnp_TmnCode: TMN_CODE,
    vnp_TxnRef: "BE2TEST123",
    vnp_Amount: "15000000",
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
  });

  const result = gateway.verifyCallback(callback);

  assert.equal(result.verified, true);
  assert.equal(result.success, true);
  assert.equal(result.transactionRef, "BE2TEST123");
});

test("VNPay rejects a modified callback", async () => {
  const gateway = await createGateway();

  const callback = signCallback({
    vnp_TmnCode: TMN_CODE,
    vnp_TxnRef: "BE2TEST123",
    vnp_Amount: "15000000",
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
  });

  callback.vnp_Amount = "99999999";

  const result = gateway.verifyCallback(callback);

  assert.equal(result.verified, false);
  assert.equal(result.success, false);
});

test("VNPay recognizes a signed failed payment", async () => {
  const gateway = await createGateway();

  const callback = signCallback({
    vnp_TmnCode: TMN_CODE,
    vnp_TxnRef: "BE2TEST123",
    vnp_Amount: "15000000",
    vnp_ResponseCode: "24",
    vnp_TransactionStatus: "02",
  });

  const result = gateway.verifyCallback(callback);

  assert.equal(result.verified, true);
  assert.equal(result.success, false);
});
