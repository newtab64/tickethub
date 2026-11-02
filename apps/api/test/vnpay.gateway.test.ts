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

  const { VnpayGateway } = await import("../src/payments/vnpay.gateway");

  return new VnpayGateway();
}

function signCallback(params: Record<string, string>): Record<string, string> {
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
  const createDate = url.searchParams.get("vnp_CreateDate");

  assert.match(createDate ?? "", /^\d{14}$/);

  assert.equal(
    result.vnpCreateDate,
    createDate,
    "Gateway must return original VNPay create date",
  );
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
  assert.equal(result.amountVnd, 150000);
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
test("W04 QueryDR: creates a valid signed request", async () => {
  const gateway = await createGateway();

  const request = gateway.buildQueryDrRequest({
    transactionRef: "BE2TEST123",
    transactionDate: "20261029153000",
    orderInfo: "TicketHub query transaction",
    ipAddress: "127.0.0.1",
  });

  assert.equal(request.vnp_Command, "querydr");
  assert.equal(request.vnp_Version, "2.1.0");
  assert.equal(request.vnp_TxnRef, "BE2TEST123");
  assert.equal(request.vnp_TransactionDate, "20261029153000");

  assert.match(request.vnp_RequestId, /^[0-9a-f]{32}$/);
  assert.match(request.vnp_SecureHash, /^[0-9a-f]{128}$/);
  const signContent = [
    request.vnp_RequestId,
    request.vnp_Version,
    request.vnp_Command,
    request.vnp_TmnCode,
    request.vnp_TxnRef,
    request.vnp_TransactionDate,
    request.vnp_CreateDate,
    request.vnp_IpAddr,
    request.vnp_OrderInfo,
  ].join("|");

  const expectedHash = createHmac("sha512", HASH_SECRET)
    .update(signContent, "utf8")
    .digest("hex");

  assert.equal(request.vnp_SecureHash, expectedHash);
});
test("VNPay rejects a signed callback with invalid amount unit", async () => {
  const gateway = await createGateway();

  const callback = signCallback({
    vnp_TmnCode: TMN_CODE,
    vnp_TxnRef: "BE2TEST123",
    vnp_Amount: "15000050", // không chia hết cho 100
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
  });

  const result = gateway.verifyCallback(callback);

  assert.equal(result.verified, false);
  assert.equal(result.success, false);
});
test("W04 QueryDR sends HTTP POST JSON", async () => {
  const gateway = await createGateway();

  const originalFetch = globalThis.fetch;
  let requestCount = 0;

  globalThis.fetch = async (_url, options) => {
    requestCount++;

    assert.equal(options?.method, "POST");

    const payload = JSON.parse(String(options?.body)) as Record<string, string>;

    assert.equal(payload.vnp_Command, "querydr");

    assert.equal(payload.vnp_TransactionDate, "20261030090000");

    assert.match(payload.vnp_SecureHash, /^[0-9a-f]{128}$/);

    return new Response(
      JSON.stringify({
        vnp_ResponseCode: "00",
        vnp_TransactionStatus: "01",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  };

  try {
    const result = await gateway.queryTransactionRaw({
      transactionRef: "BE2TEST123",
      transactionDate: "20261030090000",
      orderInfo: "TicketHub QueryDR test",
      ipAddress: "127.0.0.1",
    });

    assert.equal(requestCount, 1);
    assert.ok(result);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test("W04 QueryDR sends POST request", async () => {
  const gateway = await createGateway();

  const originalFetch = globalThis.fetch;
  let requestCount = 0;

  globalThis.fetch = async (_url, options) => {
    requestCount++;

    assert.equal(options?.method, "POST");

    const payload = JSON.parse(String(options?.body)) as Record<string, string>;

    assert.equal(payload.vnp_Command, "querydr");
    assert.equal(payload.vnp_TxnRef, "BE2TEST123");
    assert.equal(payload.vnp_TransactionDate, "20261030090000");

    return new Response(
      JSON.stringify({
        vnp_ResponseCode: "00",
        vnp_TransactionStatus: "01",
      }),
      { status: 200 },
    );
  };

  try {
    const result = await gateway.queryTransactionRaw({
      transactionRef: "BE2TEST123",
      transactionDate: "20261030090000",
      orderInfo: "TicketHub QueryDR test",
      ipAddress: "127.0.0.1",
    });

    assert.equal(requestCount, 1);
    assert.ok(result);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test("W04 QueryDR verifies a valid response", async () => {
  const gateway = await createGateway();

  const response: Record<string, string> = {
    vnp_ResponseId: "RESP123",
    vnp_Command: "querydr",
    vnp_ResponseCode: "00",
    vnp_Message: "Success",
    vnp_TmnCode: TMN_CODE,
    vnp_TxnRef: "BE2TEST123",
    vnp_Amount: "15000000",
    vnp_BankCode: "NCB",
    vnp_PayDate: "20261030100000",
    vnp_TransactionNo: "12345678",
    vnp_TransactionType: "01",
    vnp_TransactionStatus: "00",
    vnp_OrderInfo: "TicketHub test payment",
    vnp_PromotionCode: "",
    vnp_PromotionAmount: "",
  };

  const signContent = [
    response.vnp_ResponseId,
    response.vnp_Command,
    response.vnp_ResponseCode,
    response.vnp_Message,
    response.vnp_TmnCode,
    response.vnp_TxnRef,
    response.vnp_Amount,
    response.vnp_BankCode,
    response.vnp_PayDate,
    response.vnp_TransactionNo,
    response.vnp_TransactionType,
    response.vnp_TransactionStatus,
    response.vnp_OrderInfo,
    response.vnp_PromotionCode,
    response.vnp_PromotionAmount,
  ].join("|");

  response.vnp_SecureHash = createHmac("sha512", HASH_SECRET)
    .update(signContent, "utf8")
    .digest("hex");
  assert.equal(gateway.verifyQueryDrResponse(response), true);

  // Gia lap ke tan cong sua so tien
  const tamperedResponse = {
    ...response,
    vnp_Amount: "99999999",
  };

  assert.equal(gateway.verifyQueryDrResponse(tamperedResponse), false);
});
