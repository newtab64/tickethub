import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { BookingService } from "../src/booking/booking.service";
import type { WaitingRoomService } from "../src/waiting-room/waiting-room.service";
import { PaymentService } from "../src/payments/payment.service";
import { VnpayGateway } from "../src/payments/vnpay.gateway";
import type { EventReadCacheService } from "../src/events/event-read-cache.service";
import { PaymentSettlementService } from "../src/payments/payment-settlement.service";
import {
  OrderStatus,
  TransactionStatus,
  PaymentProvider,
  SeatStatus,
} from "@tickethub/shared";

import { env } from "../src/config/env.config";
import { db } from "../src/database/db";
import {
  users,
  orders,
  orderItems,
  transactions,
  ticketTypes,
  tickets,
  outbox,
  seats,
} from "../src/database/schema";
import { VnpayReconciliationService } from "../src/payments/vnpay-reconciliation.service";
import { VnpayIpnService } from "../src/payments/vnpay-ipn.service";
import { toVnpayAmount } from "../src/payments/vnpay-ipn.preview.service";
import type { VerifiedPaymentResult } from "../src/payments/payment-settlement.types";
// Safety guard: never write integration fixtures to dev DB.

const cacheStub = {
  invalidate: async (_eventId: string): Promise<void> => {
    // Unit/integration test khong can xoa Redis cache that
  },
} as EventReadCacheService;

const targetDb = decodeURIComponent(
  new URL(env.DATABASE_URL).pathname.slice(1),
);

// Cho phep developer cau hinh ten database test rieng.
// Mac dinh van su dung tickethub_ipn_test.
const expectedTestDb =
  process.env.IPN_TEST_DB_NAME?.trim() || "tickethub_ipn_test";

const isValidExpectedDb = /^[a-z][a-z0-9_]*_test$/.test(expectedTestDb);
const isSafeTestDb = isValidExpectedDb && targetDb === expectedTestDb;

async function createFixture(expired = false, withPaymentUrl = false) {
  const [user] = await db.select({ id: users.id }).from(users).limit(1);

  const [tt] = await db
    .select()
    .from(ticketTypes)
    .where(eq(ticketTypes.isSeated, false))
    .limit(1);

  if (!user || !tt) {
    throw new Error("Test DB needs seeded users and GA ticket types");
  }

  const id = randomUUID();
  const orderId = id;
  const transactionRef = "IPNTEST" + id.replace(/-/g, "");
  const orderCode = "IPN" + id.replace(/-/g, "").slice(0, 20);

  await db.transaction(async (tx) => {
    await tx.insert(orders).values({
      id: orderId,
      orderCode,
      userId: user.id,
      eventId: tt.eventId,
      totalAmount: tt.price,
      finalAmount: tt.price,
      status: OrderStatus.PENDING,
      expiresAt: new Date(Date.now() + (expired ? -60_000 : 300_000)),
    });

    await tx.insert(orderItems).values({
      orderId,
      ticketTypeId: tt.id,
      quantity: 1,
      unitPrice: tt.price,
      subtotal: tt.price,
    });

    await tx.insert(transactions).values({
      orderId,
      provider: PaymentProvider.VNPAY,
      transactionRef,
      amount: tt.price,
      status: TransactionStatus.PENDING,
      idempotencyKey: `ipn-test:${id}`,
      ...(withPaymentUrl
        ? {
            paymentUrl: `https://sandbox.example.test/pay?ref=${transactionRef}`,
            vnpCreateDate: "20261029153000",
          }
        : {}),
    });

    await tx
      .update(ticketTypes)
      .set({
        heldCount: sql`${ticketTypes.heldCount} + 1`,
      })
      .where(eq(ticketTypes.id, tt.id));
  });

  return {
    userId: user.id,
    orderId,
    transactionRef,
    amount: toVnpayAmount(tt.price)!,
    ticketTypeId: tt.id,
    heldBefore: tt.heldCount,
    soldBefore: tt.soldCount,
  };
}

// Mock only the already-verified gateway result.
// Database transactions and inventory changes remain real.
function serviceWithVerifiedCallback(transactionRef: string, success: boolean) {
  const settlementService = new PaymentSettlementService(cacheStub);
  const service = new VnpayIpnService(settlementService);

  Object.defineProperty(service, "gateway", {
    value: {
      verifyCallback: () => ({
        verified: true,
        success,
        transactionRef,
        providerTransactionId: "TESTPROVIDER001",
      }),
    },
  });

  return service;
}

async function readOrder(orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));

  const [transaction] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.orderId, orderId));

  return { order, transaction };
}

if (!isSafeTestDb) {
  test.skip(`VNPay IPN integration tests skipped: database '${targetDb}' is not test database '${expectedTestDb}'. To run integration tests, point DATABASE_URL to a database ending in _test.`, () => {});
} else {
  test("Successful IPN updates payment once", async () => {
    const fixture = await createFixture();
    const service = serviceWithVerifiedCallback(fixture.transactionRef, true);

    const callback = {
      vnp_Amount: fixture.amount,
      vnp_ResponseCode: "00",
      vnp_TransactionStatus: "00",
    };

    const first = await service.process(callback);
    assert.equal(first, "APPLY_SUCCESS");

    const second = await service.process(callback);
    assert.equal(second, "ALREADY_PROCESSED");

    const { order, transaction } = await readOrder(fixture.orderId);

    assert.equal(order?.status, OrderStatus.PAID);
    assert.equal(transaction?.status, TransactionStatus.SUCCESS);

    // Kiem tra ve thuc su duoc tao sau thanh toan
    const issuedTickets = await db
      .select()
      .from(tickets)
      .where(eq(tickets.orderId, fixture.orderId));

    // Don hang GA mua 1 ve phai tao dung 1 ban ghi
    assert.equal(issuedTickets.length, 1);

    // Ve GA khong co ghe cu the
    assert.equal(issuedTickets[0]?.seatId, null);

    // Ma ve phai duoc tao
    assert.ok(issuedTickets[0]?.ticketCode.startsWith("TK"));

    const [tt] = await db
      .select()
      .from(ticketTypes)
      .where(eq(ticketTypes.id, fixture.ticketTypeId));

    assert.equal(tt?.heldCount, fixture.heldBefore);
    assert.equal(tt?.soldCount, fixture.soldBefore + 1);

    const emittedEvents = await db
      .select({ id: outbox.id })
      .from(outbox)
      .where(
        and(
          eq(outbox.eventType, "ORDER_PAID"),
          sql`${outbox.payload} ->> 'orderId' = ${fixture.orderId}`,
        ),
      );

    assert.equal(emittedEvents.length, 1);
  });

  test("Expired-but-still-held order is paid late, ticket issued once", async () => {
    const fixture = await createFixture(true);
    const service = serviceWithVerifiedCallback(fixture.transactionRef, true);

    const result = await service.process({
      vnp_Amount: fixture.amount,
      vnp_ResponseCode: "00",
      vnp_TransactionStatus: "00",
    });

    assert.equal(result, "LATE_SUCCESS");

    const { order, transaction } = await readOrder(fixture.orderId);
    assert.equal(order?.status, OrderStatus.PAID);
    assert.equal(transaction?.status, TransactionStatus.SUCCESS);

    const issued = await db
      .select()
      .from(tickets)
      .where(eq(tickets.orderId, fixture.orderId));
    assert.equal(issued.length, 1);
  });
  test("Concurrent duplicate IPNs update inventory only once", async () => {
    const fixture = await createFixture();

    const service = serviceWithVerifiedCallback(fixture.transactionRef, true);

    const callback = {
      vnp_Amount: fixture.amount,
      vnp_ResponseCode: "00",
      vnp_TransactionStatus: "00",
    };

    const results = await Promise.all([
      service.process(callback),
      service.process(callback),
    ]);

    assert.deepEqual(
      results.sort(),
      ["ALREADY_PROCESSED", "APPLY_SUCCESS"].sort(),
    );

    const { order, transaction } = await readOrder(fixture.orderId);

    assert.equal(order?.status, OrderStatus.PAID);
    assert.equal(transaction?.status, TransactionStatus.SUCCESS);

    const issued = await db
      .select()
      .from(tickets)
      .where(eq(tickets.orderId, fixture.orderId));
    assert.equal(issued.length, 1);

    const [tt] = await db
      .select()
      .from(ticketTypes)
      .where(eq(ticketTypes.id, fixture.ticketTypeId));

    assert.equal(tt?.heldCount, fixture.heldBefore);
    assert.equal(tt?.soldCount, fixture.soldBefore + 1);
  });

  test("Wrong VNPay amount does not change database state", async () => {
    const fixture = await createFixture();

    const service = serviceWithVerifiedCallback(fixture.transactionRef, true);

    const wrongAmount = (BigInt(fixture.amount) + 100n).toString();

    const result = await service.process({
      vnp_Amount: wrongAmount,
      vnp_ResponseCode: "00",
      vnp_TransactionStatus: "00",
    });

    assert.equal(result, "AMOUNT_MISMATCH");

    const { order, transaction } = await readOrder(fixture.orderId);

    assert.equal(order?.status, OrderStatus.PENDING);
    assert.equal(transaction?.status, TransactionStatus.PENDING);

    const [tt] = await db
      .select()
      .from(ticketTypes)
      .where(eq(ticketTypes.id, fixture.ticketTypeId));

    assert.equal(tt?.heldCount, fixture.heldBefore + 1);
    assert.equal(tt?.soldCount, fixture.soldBefore);
  });

  test("Repeated failed callback does not release tickets twice", async () => {
    const fixture = await createFixture();

    const service = serviceWithVerifiedCallback(fixture.transactionRef, false);

    const callback = {
      vnp_Amount: fixture.amount,
      vnp_ResponseCode: "24",
      vnp_TransactionStatus: "02",
    };

    const first = await service.process(callback);
    const second = await service.process(callback);

    assert.equal(first, "RECORD_FAILURE");
    assert.equal(second, "ALREADY_PROCESSED");

    const { order, transaction } = await readOrder(fixture.orderId);

    assert.equal(order?.status, OrderStatus.FAILED);
    assert.equal(transaction?.status, TransactionStatus.FAILED);

    const [tt] = await db
      .select()
      .from(ticketTypes)
      .where(eq(ticketTypes.id, fixture.ticketTypeId));

    assert.equal(tt?.heldCount, fixture.heldBefore);
    assert.equal(tt?.soldCount, fixture.soldBefore);
  });

  test("IPN vs releaseHold: payment and cancellation cannot both win", async () => {
    const fixture = await createFixture();

    const ipn = serviceWithVerifiedCallback(fixture.transactionRef, true);

    const booking = new BookingService({} as WaitingRoomService, cacheStub);

    const [paymentResult, releaseResult] = await Promise.allSettled([
      ipn.process({
        vnp_Amount: fixture.amount,
        vnp_ResponseCode: "00",
        vnp_TransactionStatus: "00",
      }),
      booking.releaseHold(fixture.userId, fixture.orderId),
    ]);

    const { order, transaction } = await readOrder(fixture.orderId);

    const [tt] = await db
      .select()
      .from(ticketTypes)
      .where(eq(ticketTypes.id, fixture.ticketTypeId));

    assert.ok(order);
    assert.ok(transaction);
    assert.ok(tt);

    if (order.status === OrderStatus.PAID) {
      assert.equal(transaction.status, TransactionStatus.SUCCESS);
      assert.equal(paymentResult.status, "fulfilled");
      assert.equal(paymentResult.value, "APPLY_SUCCESS");
      assert.equal(releaseResult.status, "rejected");

      assert.equal(tt.heldCount, fixture.heldBefore);
      assert.equal(tt.soldCount, fixture.soldBefore + 1);
    } else {
      assert.equal(order.status, OrderStatus.CANCELLED);
      assert.equal(transaction.status, TransactionStatus.PENDING);
      assert.equal(releaseResult.status, "fulfilled");
      assert.equal(paymentResult.status, "fulfilled");
      assert.equal(paymentResult.value, "MANUAL_REVIEW");

      assert.equal(tt.heldCount, fixture.heldBefore);
      assert.equal(tt.soldCount, fixture.soldBefore);
    }
  });

  test("IPN vs Booking Cleanup: expired order never becomes PAID", async () => {
    const booking = new BookingService({} as WaitingRoomService, cacheStub);

    // Don cac hold da het han cua cac test truoc.
    await booking.cleanExpiredOrders();

    const fixture = await createFixture(true);

    const ipn = serviceWithVerifiedCallback(fixture.transactionRef, true);

    const [paymentResult, cleanupResult] = await Promise.allSettled([
      ipn.process({
        vnp_Amount: fixture.amount,
        vnp_ResponseCode: "00",
        vnp_TransactionStatus: "00",
      }),
      booking.cleanExpiredOrders(),
    ]);

    assert.equal(paymentResult.status, "fulfilled");
    assert.equal(cleanupResult.status, "fulfilled");
    if (paymentResult.status === "fulfilled") {
      assert.ok(
        ["LATE_SUCCESS", "MANUAL_REVIEW"].includes(paymentResult.value),
      );
    }

    const { order, transaction } = await readOrder(fixture.orderId);
    const issued = await db
      .select()
      .from(tickets)
      .where(eq(tickets.orderId, fixture.orderId));

    // Bat bien: khong bao gio phat ve ma don khong PAID, va toi da 1 bo ve.
    assert.ok(issued.length <= 1);
    if (issued.length === 1) {
      assert.equal(order?.status, OrderStatus.PAID);
    } else {
      assert.notEqual(order?.status, OrderStatus.PAID);
    }
    assert.equal(
      transaction?.status === TransactionStatus.SUCCESS,
      issued.length === 1 || order?.status === OrderStatus.EXPIRED,
    );

    const [tt] = await db
      .select()
      .from(ticketTypes)
      .where(eq(ticketTypes.id, fixture.ticketTypeId));

    assert.equal(tt?.heldCount, fixture.heldBefore);
    assert.equal(
      tt?.soldCount,
      fixture.soldBefore + (issued.length === 1 ? 1 : 0),
    );
  });

  test("Seated IPN sells seat and issues ticket once", async () => {
    const [user] = await db.select({ id: users.id }).from(users).limit(1);

    const [tt] = await db
      .select()
      .from(ticketTypes)
      .where(eq(ticketTypes.isSeated, true))
      .limit(1);

    assert.ok(user, "Test DB needs a user");
    assert.ok(tt, "Test DB needs a seated ticket type");

    const unique = randomUUID().replace(/-/g, "");
    const orderId = randomUUID();
    const transactionRef = `IPNSEAT${unique}`;
    const expiresAt = new Date(Date.now() + 300000);
    let seatId = "";

    await db.transaction(async (tx) => {
      await tx.insert(orders).values({
        id: orderId,
        orderCode: `SIT${unique.slice(0, 20)}`,
        userId: user.id,
        eventId: tt.eventId,
        totalAmount: tt.price,
        finalAmount: tt.price,
        status: OrderStatus.PENDING,
        expiresAt,
      });

      const [seat] = await tx
        .insert(seats)
        .values({
          eventId: tt.eventId,
          ticketTypeId: tt.id,
          zoneName: "IPN_INTEGRATION",
          rowLabel: "TEST",
          seatNumber: unique.slice(0, 14),
          status: SeatStatus.HELD,
          holdOrderId: orderId,
          holdExpiresAt: expiresAt,
        })
        .returning({ id: seats.id });

      assert.ok(seat);
      seatId = seat.id;

      await tx.insert(orderItems).values({
        orderId,
        ticketTypeId: tt.id,
        seatId,
        quantity: 1,
        unitPrice: tt.price,
        subtotal: tt.price,
      });

      await tx.insert(transactions).values({
        orderId,
        provider: PaymentProvider.VNPAY,
        transactionRef,
        amount: tt.price,
        status: TransactionStatus.PENDING,
        idempotencyKey: `ipn-seat-test:${unique}`,
      });
    });

    const service = serviceWithVerifiedCallback(transactionRef, true);

    const callback = {
      vnp_Amount: toVnpayAmount(tt.price)!,
      vnp_ResponseCode: "00",
      vnp_TransactionStatus: "00",
    };

    assert.equal(await service.process(callback), "APPLY_SUCCESS");

    assert.equal(await service.process(callback), "ALREADY_PROCESSED");

    const { order, transaction } = await readOrder(orderId);

    const [seatAfter] = await db
      .select()
      .from(seats)
      .where(eq(seats.id, seatId));

    const issuedTickets = await db
      .select()
      .from(tickets)
      .where(eq(tickets.orderId, orderId));

    assert.equal(order?.status, OrderStatus.PAID);
    assert.equal(transaction?.status, TransactionStatus.SUCCESS);

    assert.equal(seatAfter?.status, SeatStatus.SOLD);
    assert.equal(seatAfter?.holdOrderId, null);

    assert.equal(issuedTickets.length, 1);
    assert.equal(issuedTickets[0]?.seatId, seatId);
    assert.equal(issuedTickets[0]?.ticketTypeId, tt.id);
    assert.ok(issuedTickets[0]?.ticketCode.startsWith("TK"));
  });

  test("Failed seated IPN releases seat without issuing tickets", async () => {
    const [user] = await db.select({ id: users.id }).from(users).limit(1);

    const [tt] = await db
      .select()
      .from(ticketTypes)
      .where(eq(ticketTypes.isSeated, true))
      .limit(1);

    assert.ok(user, "Test DB needs a user");
    assert.ok(tt, "Test DB needs a seated ticket type");

    const unique = randomUUID().replace(/-/g, "");
    const orderId = randomUUID();
    const transactionRef = `IPNFAILSEAT${unique}`;
    const expiresAt = new Date(Date.now() + 300000);

    let seatId = "";

    await db.transaction(async (tx) => {
      await tx.insert(orders).values({
        id: orderId,
        orderCode: `SF${unique.slice(0, 20)}`,
        userId: user.id,
        eventId: tt.eventId,
        totalAmount: tt.price,
        finalAmount: tt.price,
        status: OrderStatus.PENDING,
        expiresAt,
      });

      const [seat] = await tx
        .insert(seats)
        .values({
          eventId: tt.eventId,
          ticketTypeId: tt.id,
          zoneName: "IPN_FAILURE_TEST",
          rowLabel: "TEST",
          seatNumber: unique.slice(0, 14),
          status: SeatStatus.HELD,
          holdOrderId: orderId,
          holdExpiresAt: expiresAt,
        })
        .returning({ id: seats.id });

      assert.ok(seat);
      seatId = seat.id;

      await tx.insert(orderItems).values({
        orderId,
        ticketTypeId: tt.id,
        seatId,
        quantity: 1,
        unitPrice: tt.price,
        subtotal: tt.price,
      });

      await tx.insert(transactions).values({
        orderId,
        provider: PaymentProvider.VNPAY,
        transactionRef,
        amount: tt.price,
        status: TransactionStatus.PENDING,
        idempotencyKey: `ipn-failure:${unique}`,
      });
    });

    // Gia lap VNPay da xac minh chu ky,
    // nhung ket qua thanh toan that bai.
    const service = serviceWithVerifiedCallback(transactionRef, false);

    const callback = {
      vnp_Amount: toVnpayAmount(tt.price)!,
      vnp_ResponseCode: "24",
      vnp_TransactionStatus: "02",
    };

    // Callback lan dau
    assert.equal(await service.process(callback), "RECORD_FAILURE");

    // Callback lap lai
    assert.equal(await service.process(callback), "ALREADY_PROCESSED");

    const { order, transaction } = await readOrder(orderId);

    const [seatAfter] = await db
      .select()
      .from(seats)
      .where(eq(seats.id, seatId));

    const issuedTickets = await db
      .select()
      .from(tickets)
      .where(eq(tickets.orderId, orderId));

    // Order va Transaction that bai
    assert.equal(order?.status, OrderStatus.FAILED);
    assert.equal(transaction?.status, TransactionStatus.FAILED);

    // Ghe duoc tra lai, khong con bi giu
    assert.equal(seatAfter?.status, SeatStatus.AVAILABLE);
    assert.equal(seatAfter?.holdOrderId, null);
    assert.equal(seatAfter?.holdExpiresAt, null);

    // Khong phat hanh ve cho giao dich that bai
    assert.equal(issuedTickets.length, 0);
  });

  test("VNPay retry reuses pending transaction", async () => {
    const fixture = await createFixture(false, true);

    // Nếu service lỡ gọi lại gateway thì test phải phát hiện.
    const originalCreatePaymentUrl = VnpayGateway.prototype.createPaymentUrl;
    const generatedRefs: string[] = [];

    VnpayGateway.prototype.createPaymentUrl = async (request) => {
      generatedRefs.push(request.transactionRef);
      return {
        transactionRef: request.transactionRef,
        paymentUrl: `https://sandbox.example.test/new?ref=${request.transactionRef}`,
        vnpCreateDate: "20261030000000",
      };
    };

    try {
      const service = new PaymentService();
      const expectedUrl = `https://sandbox.example.test/pay?ref=${fixture.transactionRef}`;

      const first = await service.createVnpayPayment(
        fixture.userId,
        fixture.orderId,
        "127.0.0.1",
      );
      const second = await service.createVnpayPayment(
        fixture.userId,
        fixture.orderId,
        "127.0.0.1",
      );

      // Cùng mã giao dịch và cùng URL đã lưu, không tạo URL mới.
      assert.equal(first.transactionRef, fixture.transactionRef);
      assert.equal(second.transactionRef, fixture.transactionRef);
      assert.equal(first.paymentUrl, expectedUrl);
      assert.equal(second.paymentUrl, expectedUrl);

      // Gateway không được gọi lại cho giao dịch đã tồn tại.
      assert.deepEqual(generatedRefs, []);

      const savedTransactions = await db
        .select()
        .from(transactions)
        .where(eq(transactions.orderId, fixture.orderId));

      assert.equal(savedTransactions.length, 1);
      assert.equal(savedTransactions[0]?.status, TransactionStatus.PENDING);
      assert.equal(
        savedTransactions[0]?.transactionRef,
        fixture.transactionRef,
      );

      const { order } = await readOrder(fixture.orderId);
      assert.equal(order?.status, OrderStatus.PENDING);
    } finally {
      VnpayGateway.prototype.createPaymentUrl = originalCreatePaymentUrl;
    }
  });

  test("Existing PENDING transaction without paymentUrl requires reconciliation", async () => {
    // Fixture mặc định: transaction PENDING nhưng thiếu paymentUrl/vnpCreateDate.
    const fixture = await createFixture();
    const service = new PaymentService();

    await assert.rejects(
      service.createVnpayPayment(fixture.userId, fixture.orderId, "127.0.0.1"),
      /requires reconciliation/,
    );
  });
}

test("W04: IPN and QueryDR settle one payment only once", async () => {
  // 1. TAO DON HANG DANG CHO THANH TOAN

  const fixture = await createFixture();

  // IPN: gia lap callback VNPay da xac minh chu ky.
  const ipn = serviceWithVerifiedCallback(fixture.transactionRef, true);

  // QueryDR: su dung PaymentSettlementService dung chung.
  const settlement = new PaymentSettlementService(cacheStub);

  // 2. TAO VERIFIED EVIDENCE CHO QUERYDR

  const queryEvidence: VerifiedPaymentResult = {
    source: "QUERYDR",

    transactionRef: fixture.transactionRef,
    amountMinor: fixture.amount,

    outcome: "SUCCESS",
    responseCode: "00",
    transactionStatus: "00",

    providerTransactionId: "TESTPROVIDER001",
    bankCode: "NCB",

    rawEvidence: {
      vnp_TxnRef: fixture.transactionRef,
      vnp_Amount: fixture.amount,
      vnp_ResponseCode: "00",
      vnp_TransactionStatus: "00",
      vnp_TransactionNo: "TESTPROVIDER001",
      vnp_BankCode: "NCB",
    },
  };

  // 3. TAO CALLBACK IPN

  const callback = {
    vnp_Amount: fixture.amount,
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
  };

  // 4. CHO IPN VA QUERYDR CHAY DONG THOI

  const [ipnResult, queryResult] = await Promise.all([
    ipn.process(callback),
    settlement.settle(queryEvidence),
  ]);

  // Chi mot luong duoc phep xac nhan thanh toan.
  // Luong con lai phai nhan ra giao dich da xu ly.

  assert.deepEqual(
    [ipnResult, queryResult].sort(),
    ["APPLY_SUCCESS", "ALREADY_PROCESSED"].sort(),
  );

  // 5. KIEM TRA ORDER VA TRANSACTION

  const { order, transaction } = await readOrder(fixture.orderId);

  assert.ok(order, "Order must exist");
  assert.ok(transaction, "Transaction must exist");

  assert.equal(order.status, OrderStatus.PAID, "Order must be PAID");

  assert.equal(
    transaction.status,
    TransactionStatus.SUCCESS,
    "Transaction must be SUCCESS",
  );

  // 6. KIEM TRA CHI PHAT HANH MOT VE
  const issuedTickets = await db
    .select()
    .from(tickets)
    .where(eq(tickets.orderId, fixture.orderId));

  assert.equal(
    issuedTickets.length,
    1,
    "Payment must issue exactly one ticket",
  );

  // Fixture mua GA nen khong co ghe cu the.
  assert.equal(issuedTickets[0]?.seatId, null);

  // Ma ve phai duoc tao.
  assert.ok(
    issuedTickets[0]?.ticketCode.startsWith("TK"),
    "Ticket code must be generated",
  );

  // 7. KIEM TRA TON KHO KHONG BI TRU HAI LAN
  const [ticketType] = await db
    .select()
    .from(ticketTypes)
    .where(eq(ticketTypes.id, fixture.ticketTypeId));

  assert.ok(ticketType, "Ticket type must exist");

  assert.equal(
    ticketType.heldCount,
    fixture.heldBefore,
    "Held count must decrease exactly once",
  );

  assert.equal(
    ticketType.soldCount,
    fixture.soldBefore + 1,
    "Sold count must increase exactly once",
  );

  // 8. KIEM TRA OUTBOX CHI TAO MOT ORDER_PAID

  const paidEvents = await db
    .select({ id: outbox.id })
    .from(outbox)
    .where(
      and(
        eq(outbox.eventType, "ORDER_PAID"),
        sql`${outbox.payload} ->> 'orderId' = ${fixture.orderId}`,
      ),
    );

  assert.equal(
    paidEvents.length,
    1,
    "ORDER_PAID event must be emitted exactly once",
  );

  // 9. QUERYDR GOI LAI CUNG KHONG DUOC CAP VE THEM

  const retryResult = await settlement.settle(queryEvidence);

  assert.equal(
    retryResult,
    "ALREADY_PROCESSED",
    "Repeated QueryDR settlement must be idempotent",
  );

  // Kiem tra lai so ve sau khi retry.
  const ticketsAfterRetry = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.orderId, fixture.orderId));

  assert.equal(
    ticketsAfterRetry.length,
    1,
    "Retry must not issue additional tickets",
  );

  // Kiem tra lai Outbox sau khi retry.
  const eventsAfterRetry = await db
    .select({ id: outbox.id })
    .from(outbox)
    .where(
      and(
        eq(outbox.eventType, "ORDER_PAID"),
        sql`${outbox.payload} ->> 'orderId' = ${fixture.orderId}`,
      ),
    );

  assert.equal(
    eventsAfterRetry.length,
    1,
    "Retry must not create another ORDER_PAID event",
  );
});

test("W04: full QueryDR and IPN race issues one ticket", async () => {
  // 1. Tao fixture thanh toan
  const fixture = await createFixture();

  // QueryDR can ngay tao giao dich goc
  const transactionDate = "20261030100000";

  await db
    .update(transactions)
    .set({ vnpCreateDate: transactionDate })
    .where(eq(transactions.transactionRef, fixture.transactionRef));

  // 2. Khoi tao hai luong
  const settlement = new PaymentSettlementService(cacheStub);

  const reconciliation = new VnpayReconciliationService(
    new PaymentService(),
    settlement,
  );

  const ipn = serviceWithVerifiedCallback(fixture.transactionRef, true);

  // 3. Mock HTTP QueryDR
  const originalFetch = globalThis.fetch;
  let queryDrCalls = 0;

  globalThis.fetch = async (_url, options) => {
    queryDrCalls++;

    assert.equal(options?.method, "POST");

    const request = JSON.parse(String(options?.body)) as Record<string, string>;

    assert.equal(request.vnp_Command, "querydr");
    assert.equal(request.vnp_TxnRef, fixture.transactionRef);
    assert.equal(request.vnp_TransactionDate, transactionDate);

    // 4. Gia lap response VNPay thanh cong
    const response: Record<string, string> = {
      vnp_ResponseId: "QUERYDRTEST001",
      vnp_Command: "querydr",
      vnp_ResponseCode: "00",
      vnp_Message: "Success",
      vnp_TmnCode: env.VNPAY_TMN_CODE,
      vnp_TxnRef: fixture.transactionRef,
      vnp_Amount: fixture.amount,
      vnp_BankCode: "NCB",
      vnp_PayDate: "20261030100000",
      vnp_TransactionNo: "123456789",
      vnp_TransactionType: "01",
      vnp_TransactionStatus: "00",
      vnp_OrderInfo: request.vnp_OrderInfo,
      vnp_PromotionCode: "",
      vnp_PromotionAmount: "",
    };

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

    const signContent = fields.map((field) => response[field] ?? "").join("|");

    response.vnp_SecureHash = createHmac("sha512", env.VNPAY_HASH_SECRET)
      .update(signContent, "utf8")
      .digest("hex");

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  };

  try {
    // 5. Chay IPN va QueryDR dong thoi
    const callback = {
      vnp_Amount: fixture.amount,
      vnp_ResponseCode: "00",
      vnp_TransactionStatus: "00",
    };

    const [ipnResult, queryResult] = await Promise.all([
      ipn.process(callback),
      reconciliation.reconcile(fixture.transactionRef, "127.0.0.1"),
    ]);

    // QueryDR phai thuc su goi HTTP mock
    assert.equal(queryDrCalls, 1);

    // Chi mot luong duoc thuc hien settlement.
    // QueryDR co the phat hien don da PAID ngay tu
    // buoc inspect, truoc khi goi settle.
    const results = [ipnResult, queryResult];

    assert.equal(
      results.filter((r) => r === "APPLY_SUCCESS").length,
      1,
      "Exactly one settlement must apply",
    );

    assert.ok(
      results.every((r) =>
        ["APPLY_SUCCESS", "ALREADY_PROCESSED", "ALREADY_PAID"].includes(r),
      ),
      `Unexpected results: ${results.join(", ")}`,
    );

    // 6. Kiem tra Order va Transaction
    const { order, transaction } = await readOrder(fixture.orderId);

    assert.equal(order?.status, OrderStatus.PAID);
    assert.equal(transaction?.status, TransactionStatus.SUCCESS);

    // 7. Khong cap ve trung
    const issuedTickets = await db
      .select()
      .from(tickets)
      .where(eq(tickets.orderId, fixture.orderId));

    assert.equal(issuedTickets.length, 1, "Must issue exactly one ticket");

    // 8. Khong ghi Outbox trung
    const paidEvents = await db
      .select({ id: outbox.id })
      .from(outbox)
      .where(
        and(
          eq(outbox.eventType, "ORDER_PAID"),
          sql`${outbox.payload} ->> 'orderId' = ${fixture.orderId}`,
        ),
      );

    assert.equal(paidEvents.length, 1, "Must emit ORDER_PAID exactly once");

    // 9. Kiem tra ton kho chi thay doi mot lan
    const [ticketType] = await db
      .select()
      .from(ticketTypes)
      .where(eq(ticketTypes.id, fixture.ticketTypeId));

    assert.equal(ticketType?.heldCount, fixture.heldBefore);

    assert.equal(ticketType?.soldCount, fixture.soldBefore + 1);
  } finally {
    // Luon khoi phuc fetch, ke ca khi test loi
    globalThis.fetch = originalFetch;
  }
});

test("W04: QueryDR rejects invalid signature and wrong amount", async (t) => {
  const scenarios = [
    {
      name: "Reject tampered QueryDR signature",
      kind: "BAD_SIGNATURE",
      expected: "INVALID_SIGNATURE",
    },
    {
      name: "Reject signed QueryDR with wrong amount",
      kind: "WRONG_AMOUNT",
      expected: "AMOUNT_MISMATCH",
    },
  ] as const;

  for (const scenario of scenarios) {
    await t.test(scenario.name, async () => {
      // 1. Tao order PENDING
      const fixture = await createFixture();

      const transactionDate = "20261030100000";

      await db
        .update(transactions)
        .set({ vnpCreateDate: transactionDate })
        .where(eq(transactions.transactionRef, fixture.transactionRef));

      const settlement = new PaymentSettlementService(cacheStub);

      const reconciliation = new VnpayReconciliationService(
        new PaymentService(),
        settlement,
      );

      // 2. Mock HTTP QueryDR
      const originalFetch = globalThis.fetch;
      let fetchCalls = 0;

      globalThis.fetch = async (_url, options) => {
        fetchCalls++;

        assert.equal(options?.method, "POST");

        const request = JSON.parse(String(options?.body)) as Record<
          string,
          string
        >;

        assert.equal(request.vnp_TxnRef, fixture.transactionRef);

        assert.equal(request.vnp_TransactionDate, transactionDate);

        // 3. Tao response hop le ban dau
        const response: Record<string, string> = {
          vnp_ResponseId: "QUERYDRNEGTEST",
          vnp_Command: "querydr",
          vnp_ResponseCode: "00",
          vnp_Message: "Success",
          vnp_TmnCode: env.VNPAY_TMN_CODE,
          vnp_TxnRef: fixture.transactionRef,
          vnp_Amount: fixture.amount,
          vnp_BankCode: "NCB",
          vnp_PayDate: "20261030100000",
          vnp_TransactionNo: "NEGTEST001",
          vnp_TransactionType: "01",
          vnp_TransactionStatus: "00",
          vnp_OrderInfo: request.vnp_OrderInfo,
          vnp_PromotionCode: "",
          vnp_PromotionAmount: "",
        };

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

        const signResponse = () => {
          const signContent = fields
            .map((field) => response[field] ?? "")
            .join("|");

          return createHmac("sha512", env.VNPAY_HASH_SECRET)
            .update(signContent, "utf8")
            .digest("hex");
        };

        // Ky response goc
        response.vnp_SecureHash = signResponse();

        // 4. Gia lap hai tinh huong bao mat
        const wrongAmount = (BigInt(fixture.amount) + 100n).toString();

        if (scenario.kind === "BAD_SIGNATURE") {
          // Sua tien SAU khi ky => chu ky sai
          response.vnp_Amount = wrongAmount;
        } else {
          // Sua tien TRUOC khi ky lai
          // => chu ky dung nhung tien khong khop DB
          response.vnp_Amount = wrongAmount;
          response.vnp_SecureHash = signResponse();
        }

        return new Response(JSON.stringify(response), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
      };

      try {
        // 5. Goi toan bo Reconciliation Service
        const result = await reconciliation.reconcile(
          fixture.transactionRef,
          "127.0.0.1",
        );

        assert.equal(fetchCalls, 1);

        assert.equal(result, scenario.expected);

        // 6. Kiem tra database khong bi thay doi
        const { order, transaction } = await readOrder(fixture.orderId);

        assert.equal(order?.status, OrderStatus.PENDING);

        assert.equal(transaction?.status, TransactionStatus.PENDING);

        // 7. Khong duoc phat hanh ve
        const issuedTickets = await db
          .select({ id: tickets.id })
          .from(tickets)
          .where(eq(tickets.orderId, fixture.orderId));

        assert.equal(
          issuedTickets.length,
          0,
          "Invalid QueryDR must not issue tickets",
        );

        // 8. Khong duoc tao su kien ORDER_PAID
        const paidEvents = await db
          .select({ id: outbox.id })
          .from(outbox)
          .where(
            and(
              eq(outbox.eventType, "ORDER_PAID"),
              sql`${outbox.payload} ->> 'orderId' = ${fixture.orderId}`,
            ),
          );

        assert.equal(
          paidEvents.length,
          0,
          "Invalid QueryDR must not emit ORDER_PAID",
        );

        // 9. Ton kho phai giu nguyen
        const [ticketType] = await db
          .select()
          .from(ticketTypes)
          .where(eq(ticketTypes.id, fixture.ticketTypeId));

        assert.equal(ticketType?.heldCount, fixture.heldBefore + 1);

        assert.equal(ticketType?.soldCount, fixture.soldBefore);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  }
});
