import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { isIP } from "node:net";

import { env } from "../config/env.config";

import type {
  PaymentGateway,
  CreatePaymentRequest,
  CreatePaymentResult,
  VerifyPaymentResult,
} from "./payment-gateway.interface";

const VNPAY_VERSION = "2.1.0";
const PAYMENT_EXPIRE_MINUTES = 15;
const TXN_REF_REGEX = /^[A-Za-z0-9]{1,100}$/;

// VNPay sử dụng múi giờ GMT+7.
function formatVnpayDate(date: Date): string {
  const vietnamTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);

  return vietnamTime.toISOString().slice(0, 19).replace(/\D/g, "");
}

// Sắp xếp tham số và mã hóa thống nhất khi ký/xác minh.
function buildSignData(params: Record<string, string>): string {
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
  return query.toString();
}

function signData(data: string, secret: string): string {
  return createHmac("sha512", secret).update(data, "utf8").digest("hex");
}

function hasValidConfig(): boolean {
  return (
    env.VNPAY_TMN_CODE.trim().length > 0 &&
    env.VNPAY_HASH_SECRET.trim().length > 0 &&
    env.VNPAY_TMN_CODE !== "TEST_TMN_CODE" &&
    env.VNPAY_HASH_SECRET !== "TEST_HASH_SECRET"
  );
}

export interface QueryDrSignatureInspection {
  verified: boolean;
  reason:
    | "OK"
    | "INVALID_RESPONSE_OBJECT"
    | "INVALID_MERCHANT_CONFIG"
    | "MISSING_OR_INVALID_HASH"
    | "MISSING_REQUIRED_FIELD"
    | "MERCHANT_MISMATCH"
    | "INVALID_COMMAND"
    | "UNSUPPORTED_SIGNED_FIELD_TYPE"
    | "HMAC_MISMATCH";
  field?: string;
}

export interface QueryDrInput {
  transactionRef: string;
  transactionDate: string;
  orderInfo: string;
  ipAddress: string;
}

export interface RefundRequestInput {
  requestId: string;
  transactionRef: string;
  transactionDate: string;
  transactionNo?: string;

  // Don vi VNPay: VND x 100
  originalAmountMinor: string;
  refundAmountMinor: string;

  createDate: string;
  createBy: string;
  ipAddress: string;
  orderInfo: string;
}

const REFUND_REQUEST_FIELDS = [
  "vnp_RequestId",
  "vnp_Version",
  "vnp_Command",
  "vnp_TmnCode",
  "vnp_TransactionType",
  "vnp_TxnRef",
  "vnp_Amount",
  "vnp_TransactionNo",
  "vnp_TransactionDate",
  "vnp_CreateBy",
  "vnp_CreateDate",
  "vnp_IpAddr",
  "vnp_OrderInfo",
] as const;

const REFUND_RESPONSE_FIELDS = [
  "vnp_ResponseId",
  "vnp_Command",
  "vnp_ResponseCode",
  "vnp_Message",
  "vnp_TmnCode",
  "vnp_TxnRef",
  "vnp_Amount",
  "vnp_BankCode",
  "vnp_PayDate",
  "vnp_TransactionNo",
  "vnp_TransactionType",
  "vnp_TransactionStatus",
  "vnp_OrderInfo",
] as const;

export class VnpayGateway implements PaymentGateway {
  async createPaymentUrl(
    request: CreatePaymentRequest,
  ): Promise<CreatePaymentResult> {
    if (!hasValidConfig()) {
      throw new Error("VNPay Sandbox credentials not configured");
    }

    if (
      !Number.isSafeInteger(request.amountVnd) ||
      request.amountVnd <= 0 ||
      !Number.isSafeInteger(request.amountVnd * 100) ||
      request.amountVnd * 100 >= 1_000_000_000_000
    ) {
      throw new Error("Invalid payment amount");
    }

    if (!TXN_REF_REGEX.test(request.transactionRef)) {
      throw new Error("Invalid transaction reference");
    }

    const orderInfo = request.orderInfo.trim();

    if (
      orderInfo.length === 0 ||
      orderInfo.length > 255 ||
      !/^[\x20-\x7E]+$/.test(orderInfo)
    ) {
      throw new Error(
        "Order info must be printable ASCII, maximum 255 characters",
      );
    }

    // Không cho phép client tự chọn URL chuyển hướng.
    if (request.returnUrl !== env.VNPAY_RETURN_URL) {
      throw new Error("Untrusted VNPay return URL");
    }

    if (isIP(request.ipAddress) === 0) {
      throw new Error("Invalid client IP address");
    }

    const now = new Date();
    const expireAt =
      request.expiresAt ??
      new Date(now.getTime() + PAYMENT_EXPIRE_MINUTES * 60 * 1000);

    if (
      !Number.isFinite(expireAt.getTime()) ||
      expireAt.getTime() <= now.getTime() + 30_000
    ) {
      throw new Error("Payment expiration time is invalid");
    }

    const createDate = formatVnpayDate(now);

    const params: Record<string, string> = {
      vnp_Version: VNPAY_VERSION,
      vnp_Command: "pay",
      vnp_TmnCode: env.VNPAY_TMN_CODE,
      vnp_Amount: String(request.amountVnd * 100),
      vnp_CurrCode: "VND",
      vnp_TxnRef: request.transactionRef,
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: "other",
      vnp_Locale: "vn",
      vnp_ReturnUrl: env.VNPAY_RETURN_URL,
      vnp_IpAddr: request.ipAddress,
      vnp_CreateDate: createDate,
      vnp_ExpireDate: formatVnpayDate(expireAt),
    };

    const signContent = buildSignData(params);
    const secureHash = signData(signContent, env.VNPAY_HASH_SECRET);

    const url = new URL(env.VNPAY_URL);
    url.search = `${signContent}&vnp_SecureHash=${secureHash}`;

    return {
      transactionRef: request.transactionRef,
      paymentUrl: url.toString(),
      vnpCreateDate: createDate,
    };
  }

  buildQueryDrRequest(input: QueryDrInput): Record<string, string> {
    // ===== PHẦN A: KIỂM TRA DỮ LIỆU =====
    if (!TXN_REF_REGEX.test(input.transactionRef)) {
      throw new Error("Invalid transaction reference");
    }

    if (!/^\d{14}$/.test(input.transactionDate)) {
      throw new Error("Invalid transaction date");
    }

    if (isIP(input.ipAddress) === 0) {
      throw new Error("Invalid IP address");
    }

    if (!hasValidConfig()) {
      throw new Error("VNPay credentials not configured");
    }

    // ===== PHẦN B: TẠO THAM SỐ QUERYDR =====
    const params: Record<string, string> = {
      vnp_RequestId: randomBytes(16).toString("hex"),
      vnp_Version: VNPAY_VERSION,
      vnp_Command: "querydr",
      vnp_TmnCode: env.VNPAY_TMN_CODE,
      vnp_TxnRef: input.transactionRef,
      vnp_TransactionDate: input.transactionDate,
      vnp_CreateDate: formatVnpayDate(new Date()),
      vnp_IpAddr: input.ipAddress,
      vnp_OrderInfo: input.orderInfo.trim(),
    };

    // ===== PHẦN C: TẠO CHỮ KÝ HMAC (đúng thứ tự VNPay quy định) =====
    const signContent = [
      params.vnp_RequestId,
      params.vnp_Version,
      params.vnp_Command,
      params.vnp_TmnCode,
      params.vnp_TxnRef,
      params.vnp_TransactionDate,
      params.vnp_CreateDate,
      params.vnp_IpAddr,
      params.vnp_OrderInfo,
    ].join("|");

    const secureHash = signData(signContent, env.VNPAY_HASH_SECRET);

    return {
      ...params,
      vnp_SecureHash: secureHash,
    };
  }

  async queryTransactionRaw(input: QueryDrInput): Promise<unknown> {
    // 1. Su dung ham tao request da lam o Bai 3A
    const payload = this.buildQueryDrRequest(input);

    const endpoint = new URL(env.VNPAY_QUERYDR_URL);

    // Giai doan sandbox: chi cho phep endpoint chinh thuc
    if (
      endpoint.href !==
      "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction"
    ) {
      throw new Error("Untrusted VNPay QueryDR endpoint");
    }

    // 3. Gui HTTP POST den VNPay
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });

    if (!response.ok) {
      throw new Error(`VNPay QueryDR HTTP error: ${response.status}`);
    }

    // 5. Gioi han kich thuoc response
    const body = await response.text();

    if (Buffer.byteLength(body, "utf8") > 64 * 1024) {
      throw new Error("VNPay response is too large");
    }

    let data: unknown;

    try {
      data = JSON.parse(body);
    } catch {
      throw new Error("VNPay returned invalid JSON");
    }

    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Invalid VNPay response");
    }

    return data;
  }

  /**
   * Validates the *actual* VNPAY QueryDR HMAC-SHA512, not just the response code.
   * JSON optional fields can be omitted or null. Null/missing mean an empty
   * field in the documented pipe-delimited checksum input.
   * Safe-integer JSON numbers are normalized only for HMAC verification;
   * tampered responses will still fail timing-safe comparison.
   * Never include the secret, the received hash or raw response in logs.
   */
  inspectQueryDrSignature(raw: unknown): QueryDrSignatureInspection {
    const reject = (
      reason: QueryDrSignatureInspection["reason"],
      field?: string,
    ): QueryDrSignatureInspection => ({
      verified: false,
      reason,
      ...(field ? { field } : {}),
    });

    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return reject("INVALID_RESPONSE_OBJECT");
    }
    if (!hasValidConfig()) {
      return reject("INVALID_MERCHANT_CONFIG");
    }

    const data = raw as Record<string, unknown>;
    const receivedHash = data.vnp_SecureHash;
    if (
      typeof receivedHash !== "string" ||
      !/^[0-9a-fA-F]{128}$/.test(receivedHash)
    ) {
      return reject("MISSING_OR_INVALID_HASH");
    }

    if (typeof data.vnp_ResponseId !== "string") {
      return reject("MISSING_REQUIRED_FIELD", "vnp_ResponseId");
    }
    if (typeof data.vnp_ResponseCode !== "string") {
      return reject("MISSING_REQUIRED_FIELD", "vnp_ResponseCode");
    }
    if (typeof data.vnp_TxnRef !== "string") {
      return reject("MISSING_REQUIRED_FIELD", "vnp_TxnRef");
    }
    if (data.vnp_TmnCode !== env.VNPAY_TMN_CODE) {
      return reject("MERCHANT_MISMATCH");
    }
    if (data.vnp_Command != null && data.vnp_Command !== "querydr") {
      return reject("INVALID_COMMAND");
    }

    const signFields = [
      "vnp_ResponseId",
      "vnp_Command",
      "vnp_ResponseCode",
      "vnp_Message",
      "vnp_TmnCode",
      "vnp_TxnRef",
      "vnp_Amount",
      "vnp_BankCode",
      "vnp_PayDate",
      "vnp_TransactionNo",
      "vnp_TransactionType",
      "vnp_TransactionStatus",
      "vnp_OrderInfo",
      "vnp_PromotionCode",
      "vnp_PromotionAmount",
    ] as const;

    const values: string[] = [];
    for (const field of signFields) {
      const value = data[field];
      if (value == null) {
        values.push("");
      } else if (typeof value === "string") {
        values.push(value);
      } else if (
        typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value >= 0
      ) {
        values.push(String(value));
      } else {
        return reject("UNSUPPORTED_SIGNED_FIELD_TYPE", field);
      }
    }

    const expectedHash = signData(values.join("|"), env.VNPAY_HASH_SECRET);
    const receivedBuffer = Buffer.from(receivedHash, "hex");
    const expectedBuffer = Buffer.from(expectedHash, "hex");
    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      return reject("HMAC_MISMATCH");
    }
    return { verified: true, reason: "OK" };
  }

  verifyQueryDrResponse(raw: unknown): boolean {
    return this.inspectQueryDrSignature(raw).verified;
  }

  verifyCallback(params: Record<string, string>): VerifyPaymentResult {
    const invalid: VerifyPaymentResult = {
      verified: false,
      success: false,
      transactionRef: null,
    };

    if (!hasValidConfig()) {
      return invalid;
    }

    const receivedHash = params.vnp_SecureHash;

    if (!receivedHash || !/^[0-9a-fA-F]{128}$/.test(receivedHash)) {
      return invalid;
    }

    const expectedHash = signData(buildSignData(params), env.VNPAY_HASH_SECRET);

    const received = Buffer.from(receivedHash, "hex");
    const expected = Buffer.from(expectedHash, "hex");

    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      return invalid;
    }

    const transactionRef = params.vnp_TxnRef;

    if (
      params.vnp_TmnCode !== env.VNPAY_TMN_CODE ||
      !transactionRef ||
      !TXN_REF_REGEX.test(transactionRef) ||
      !/^[1-9]\d*$/.test(params.vnp_Amount ?? "") ||
      !params.vnp_ResponseCode ||
      !params.vnp_TransactionStatus
    ) {
      return invalid;
    }

    const amountMinor = Number(params.vnp_Amount);

    // VNPay gửi số tiền nhân 100, nên phải là số nguyên chia hết cho 100.
    if (!Number.isSafeInteger(amountMinor) || amountMinor % 100 !== 0) {
      return invalid;
    }

    return {
      verified: true,
      success:
        params.vnp_ResponseCode === "00" &&
        params.vnp_TransactionStatus === "00",
      transactionRef,
      amountVnd: amountMinor / 100,
      ...(params.vnp_TransactionNo
        ? { providerTransactionId: params.vnp_TransactionNo }
        : {}),
    };
  }

  buildRefundRequest(input: RefundRequestInput): Record<string, string> {
    if (!hasValidConfig()) {
      throw new Error("VNPay credentials not configured");
    }

    if (!/^[A-Za-z0-9]{1,32}$/.test(input.requestId)) {
      throw new Error("Invalid refund request ID");
    }

    if (!/^[A-Za-z0-9]{1,100}$/.test(input.transactionRef)) {
      throw new Error("Invalid transaction reference");
    }

    if (
      !/^\d{14}$/.test(input.transactionDate) ||
      !/^\d{14}$/.test(input.createDate)
    ) {
      throw new Error("Invalid VNPay date");
    }

    const validAmount = (value: string) =>
      /^\d{1,12}$/.test(value) && BigInt(value) > 0n;

    if (
      !validAmount(input.refundAmountMinor) ||
      !validAmount(input.originalAmountMinor)
    ) {
      throw new Error("Invalid refund amount");
    }

    const refundAmount = BigInt(input.refundAmountMinor);
    const originalAmount = BigInt(input.originalAmountMinor);

    if (refundAmount > originalAmount) {
      throw new Error("Refund exceeds original payment");
    }

    if (input.transactionNo && !/^\d{1,15}$/.test(input.transactionNo)) {
      throw new Error("Invalid VNPay transaction number");
    }

    if (
      input.createBy.length < 1 ||
      input.createBy.length > 245 ||
      !/^[\x20-\x7E]+$/.test(input.createBy)
    ) {
      throw new Error("Invalid refund creator");
    }

    if (
      input.orderInfo.length < 1 ||
      input.orderInfo.length > 255 ||
      !/^[\x20-\x7E]+$/.test(input.orderInfo)
    ) {
      throw new Error("Invalid refund description");
    }

    if (isIP(input.ipAddress) === 0) {
      throw new Error("Invalid IP address");
    }

    const transactionType = refundAmount === originalAmount ? "02" : "03";

    const payload: Record<string, string> = {
      vnp_RequestId: input.requestId,
      vnp_Version: "2.1.0",
      vnp_Command: "refund",
      vnp_TmnCode: env.VNPAY_TMN_CODE,
      vnp_TransactionType: transactionType,
      vnp_TxnRef: input.transactionRef,
      vnp_Amount: input.refundAmountMinor,
      vnp_TransactionNo: input.transactionNo ?? "",
      vnp_TransactionDate: input.transactionDate,
      vnp_CreateBy: input.createBy,
      vnp_CreateDate: input.createDate,
      vnp_IpAddr: input.ipAddress,
      vnp_OrderInfo: input.orderInfo,
    };

    const signContent = REFUND_REQUEST_FIELDS.map(
      (field) => payload[field],
    ).join("|");

    return {
      ...payload,
      vnp_SecureHash: signData(signContent, env.VNPAY_HASH_SECRET),
    };
  }
  async postRefundRaw(payload: Record<string, string>): Promise<unknown> {
    const endpoint = new URL(env.VNPAY_QUERYDR_URL);

    // Giai doan nay chi cho phep sandbox VNPay
    if (
      endpoint.href !==
      "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction"
    ) {
      throw new Error("Untrusted VNPay refund endpoint");
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });

    if (!response.ok) {
      throw new Error(`VNPay refund HTTP error: ${response.status}`);
    }

    const maxBytes = 64 * 1024;
    const contentLength = response.headers.get("content-length");

    if (contentLength && Number(contentLength) > maxBytes) {
      throw new Error("Refund response too large");
    }

    const body = await response.text();

    if (Buffer.byteLength(body, "utf8") > maxBytes) {
      throw new Error("Refund response too large");
    }

    let data: unknown;

    try {
      data = JSON.parse(body);
    } catch {
      throw new Error("Invalid refund JSON");
    }

    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Invalid refund response");
    }

    return data;
  }

  verifyRefundResponse(raw: unknown, request: Record<string, string>): boolean {
    if (
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw) ||
      !hasValidConfig()
    ) {
      return false;
    }

    const data = raw as Record<string, unknown>;

    const receivedHash = data.vnp_SecureHash;

    if (
      typeof receivedHash !== "string" ||
      !/^[0-9a-fA-F]{128}$/.test(receivedHash)
    ) {
      return false;
    }

    if (
      data.vnp_TmnCode !== env.VNPAY_TMN_CODE ||
      data.vnp_TxnRef !== request.vnp_TxnRef ||
      data.vnp_Amount !== request.vnp_Amount ||
      data.vnp_TransactionType !== request.vnp_TransactionType
    ) {
      return false;
    }

    if (data.vnp_Command !== undefined && data.vnp_Command !== "refund") {
      return false;
    }

    for (const field of [
      "vnp_ResponseId",
      "vnp_ResponseCode",
      "vnp_TransactionStatus",
    ]) {
      if (typeof data[field] !== "string") {
        return false;
      }
    }

    const values: string[] = [];

    for (const field of REFUND_RESPONSE_FIELDS) {
      const value = data[field];

      if (value !== undefined && typeof value !== "string") {
        return false;
      }

      values.push(value ?? "");
    }

    const expectedHash = signData(values.join("|"), env.VNPAY_HASH_SECRET);

    const received = Buffer.from(receivedHash, "hex");
    const expected = Buffer.from(expectedHash, "hex");

    return (
      received.length === expected.length && timingSafeEqual(received, expected)
    );
  }
}
