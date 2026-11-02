import { test, after, mock } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { env } from "../src/config/env.config";
import { db, sqlClient } from "../src/database/db";
import { PaymentService } from "../src/payments/payment.service";
import { VnpayGateway } from "../src/payments/vnpay.gateway";
import { toVnpayAmount } from "../src/payments/vnpay-amount";
import {
  users,
  events,
  orders,
  transactions,
  idempotencyKeys,
} from "../src/database/schema";

import { UserRole, OrderStatus, TransactionStatus } from "@tickethub/shared";

after(async () => {
  // Đóng kết nối DB để tiến trình test thoát được
  await sqlClient.end();
});

function signQueryDrForTest(
  data: Record<string, string>,
): Record<string, string> {
  const fields = [
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
  ];

  const signContent = fields.map((field) => data[field] ?? "").join("|");

  const secureHash = createHmac("sha512", env.VNPAY_HASH_SECRET)
    .update(signContent, "utf8")
    .digest("hex");

  return { ...data, vnp_SecureHash: secureHash };
}

console.log(
  "TMN:",
  env.VNPAY_TMN_CODE,
  "| secret mẫu:",
  env.VNPAY_HASH_SECRET === "TEST_HASH_SECRET",
  "| secret rỗng:",
  env.VNPAY_HASH_SECRET.trim() === "",
);

test("W04 - Payment Idempotency + QueryDR inspection", async () => {
  // 1. Lấy buyer và event có sẵn
  const [buyer] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, UserRole.BUYER))
    .limit(1);

  const [event] = await db.select({ id: events.id }).from(events).limit(1);

  assert.ok(buyer, "Buyer must exist");
  assert.ok(event, "Event must exist");

  // 2. Tạo order PENDING
  const [order] = await db
    .insert(orders)
    .values({
      orderCode: `W04${randomUUID().replace(/-/g, "").slice(0, 24)}`,
      userId: buyer.id,
      eventId: event.id,
      totalAmount: "100000.00",
      finalAmount: "100000.00",
      status: OrderStatus.PENDING,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    })
    .returning();

  assert.ok(order, "Order must be created");

  const key = randomUUID();

  // 3. Mock gateway (không gọi VNPay thật), tự restore sau test
  const createUrlMock = mock.method(
    VnpayGateway.prototype,
    "createPaymentUrl",
    async (request: { transactionRef: string }) => ({
      transactionRef: request.transactionRef,
      paymentUrl: `https://example.invalid/pay?ref=${request.transactionRef}`,
      vnpCreateDate: "20261029153000", // phải đúng 14 chữ số
    }),
  );

  try {
    const service = new PaymentService();

    // 4. Hai request đồng thời với cùng idempotency key
    const [first, second] = await Promise.all([
      service.createVnpayPayment(buyer.id, order.id, "127.0.0.1", key),
      service.createVnpayPayment(buyer.id, order.id, "127.0.0.1", key),
    ]);

    assert.equal(first.transactionRef, second.transactionRef);
    assert.equal(first.paymentUrl, second.paymentUrl);

    // 5. Chỉ có đúng 1 transaction
    const paymentRows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.orderId, order.id));
    assert.equal(paymentRows.length, 1);

    // 6. Chỉ có đúng 1 idempotency key, status 200
    const keyRows = await db
      .select()
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, key));
    assert.equal(keyRows.length, 1);
    assert.equal(keyRows[0]?.responseStatus, 200);

    // 7. Lấy transaction SAU khi đã tạo payment
    const transaction = paymentRows[0];
    assert.ok(transaction, "Transaction must exist");

    const amount = toVnpayAmount(transaction.amount);
    assert.ok(amount, "VNPay amount must be valid");

    const validResponse = signQueryDrForTest({
      vnp_ResponseId: "QUERYTEST001",
      vnp_Command: "querydr",
      vnp_ResponseCode: "00",
      vnp_Message: "Success",
      vnp_TmnCode: env.VNPAY_TMN_CODE,
      vnp_TxnRef: transaction.transactionRef,
      vnp_Amount: amount,
      vnp_BankCode: "NCB",
      vnp_PayDate: "20261030100000",
      vnp_TransactionNo: "12345678",
      vnp_TransactionType: "01",
      vnp_TransactionStatus: "00",
      vnp_OrderInfo: "TicketHub test payment",
      vnp_PromotionCode: "",
      vnp_PromotionAmount: "",
    });

    // ===== Trường hợp A: thanh toán thành công, chưa áp dụng =====
    const decision = await service.inspectQueryDrResponse(
      transaction.transactionRef,
      validResponse,
    );
    assert.equal(decision, "PAYMENT_CONFIRMED_NEEDS_APPLY");

    // ===== Kiểm tra phương thức chỉ đọc (phải chạy trước khi sửa fixture) =====
    const savedOrder = await db.query.orders.findFirst({
      where: eq(orders.id, order.id),
    });
    const savedTransaction = await db.query.transactions.findFirst({
      where: eq(transactions.id, transaction.id),
    });

    assert.equal(savedOrder?.status, OrderStatus.PENDING);
    assert.equal(savedTransaction?.status, TransactionStatus.PENDING);

    // ===== Trường hợp B1: sai chữ ký =====
    const tampered = { ...validResponse, vnp_Amount: "99999999" };
    const invalidDecision = await service.inspectQueryDrResponse(
      transaction.transactionRef,
      tampered,
    );
    assert.equal(invalidDecision, "INVALID_SIGNATURE");

    // ===== Trường hợp B2: ký đúng nhưng sai số tiền =====
    const wrongAmountResponse = signQueryDrForTest({
      ...validResponse,
      vnp_Amount: (BigInt(amount) + 100n).toString(),
    });
    const amountDecision = await service.inspectQueryDrResponse(
      transaction.transactionRef,
      wrongAmountResponse,
    );
    assert.equal(amountDecision, "AMOUNT_MISMATCH");

    // ===== Trường hợp C: đơn đã thanh toán =====
    await db
      .update(orders)
      .set({ status: OrderStatus.PAID })
      .where(eq(orders.id, order.id));
    await db
      .update(transactions)
      .set({ status: TransactionStatus.SUCCESS })
      .where(eq(transactions.id, transaction.id));

    const paidDecision = await service.inspectQueryDrResponse(
      transaction.transactionRef,
      validResponse,
    );
    assert.equal(paidDecision, "ALREADY_PAID");

    // ===== Trường hợp D: đơn PENDING nhưng đã hết hạn =====

    // ===== Truong hop D: thanh toan den muon, order EXPIRED =====
    await db
      .update(orders)
      .set({
        status: OrderStatus.EXPIRED,
        expiresAt: new Date(Date.now() - 60 * 1000),
      })
      .where(eq(orders.id, order.id));

    await db
      .update(transactions)
      .set({ status: TransactionStatus.PENDING })
      .where(eq(transactions.id, transaction.id));

    const expiredDecision = await service.inspectQueryDrResponse(
      transaction.transactionRef,
      validResponse,
    );

    assert.equal(expiredDecision, "PAYMENT_CONFIRMED_NEEDS_APPLY");
  } finally {
    createUrlMock.mock.restore();

    // Dọn dữ liệu test (xóa bảng con trước, bảng cha sau)
    await db.delete(transactions).where(eq(transactions.orderId, order.id));
    await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, key));
    await db.delete(orders).where(eq(orders.id, order.id));
  }
});
