import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";

import {
  OrderStatus,
  TransactionStatus,
  PaymentProvider,
  RefundStatus,
  SeatStatus,
} from "@tickethub/shared";

import { BookingService } from "../src/booking/booking.service";
import type { WaitingRoomService } from "../src/waiting-room/waiting-room.service";
import type { EventReadCacheService } from "../src/events/event-read-cache.service";
import { VnpayIpnService } from "../src/payments/vnpay-ipn.service";
import { PaymentSettlementService } from "../src/payments/payment-settlement.service";
import { toVnpayAmount } from "../src/payments/vnpay-amount";
import { LATE_REFUND_REASON } from "../src/payments/refund-reasons";
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
  refunds,
} from "../src/database/schema";

const cacheStub = {
  invalidate: async (_eventId: string): Promise<void> => {},
} as EventReadCacheService;

const targetDb = decodeURIComponent(
  new URL(env.DATABASE_URL).pathname.slice(1),
);
const expectedTestDb =
  process.env.IPN_TEST_DB_NAME?.trim() || "tickethub_ipn_test";
const isSafeTestDb =
  /^[a-z][a-z0-9_]*_test$/.test(expectedTestDb) && targetDb === expectedTestDb;

function ipnService(transactionRef: string) {
  const service = new VnpayIpnService(new PaymentSettlementService(cacheStub));
  Object.defineProperty(service, "gateway", {
    value: {
      verifyCallback: () => ({
        verified: true,
        success: true,
        transactionRef,
        providerTransactionId: "LATEPROVIDER001",
      }),
    },
  });
  return service;
}

// Tao don ghe da het han + giao dich PENDING, nhu tinh huong khach tra tien tre.
async function createLateFixture() {
  const [user] = await db.select({ id: users.id }).from(users).limit(1);
  const [tt] = await db
    .select()
    .from(ticketTypes)
    .where(eq(ticketTypes.isSeated, true))
    .limit(1);
  assert.ok(user && tt, "Test DB needs seeded users and a seated ticket type");

  const unique = randomUUID().replace(/-/g, "");
  const orderId = randomUUID();
  const seatId = randomUUID();
  const transactionRef = `LATE${unique}`;
  const expiresAt = new Date(Date.now() - 60_000); // da het han

  await db.transaction(async (tx) => {
    await tx.insert(orders).values({
      id: orderId,
      orderCode: `LT${unique.slice(0, 20)}`,
      userId: user.id,
      eventId: tt.eventId,
      totalAmount: tt.price,
      finalAmount: tt.price,
      status: OrderStatus.PENDING,
      expiresAt,
    });

    await tx.insert(seats).values({
      id: seatId,
      eventId: tt.eventId,
      ticketTypeId: tt.id,
      zoneName: "LATE_IPN_TEST",
      rowLabel: "TEST",
      seatNumber: unique.slice(0, 14),
      status: SeatStatus.HELD,
      holdOrderId: orderId,
      holdExpiresAt: expiresAt,
    });

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
      idempotencyKey: `late-test:${unique}`,
    });
  });

  return {
    orderId,
    seatId,
    transactionRef,
    callback: {
      vnp_Amount: toVnpayAmount(tt.price)!,
      vnp_ResponseCode: "00",
      vnp_TransactionStatus: "00",
    },
  };
}

// Mo phong khach khac mua ghe sau khi don het han.
async function takeSeatByAnotherBuyer(seatId: string) {
  await db
    .update(seats)
    .set({ status: SeatStatus.SOLD, holdOrderId: null, holdExpiresAt: null })
    .where(eq(seats.id, seatId));
}

async function readState(orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  const [transaction] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.orderId, orderId));
  const issued = await db
    .select()
    .from(tickets)
    .where(eq(tickets.orderId, orderId));
  const paidEvents = await db
    .select({ id: outbox.id })
    .from(outbox)
    .where(
      and(
        eq(outbox.eventType, "ORDER_PAID"),
        sql`${outbox.payload} ->> 'orderId' = ${orderId}`,
      ),
    );
  const orderRefunds = await db
    .select()
    .from(refunds)
    .where(eq(refunds.orderId, orderId));
  return { order, transaction, issued, paidEvents, orderRefunds };
}

if (!isSafeTestDb) {
  test.skip(`Late IPN tests skipped: '${targetDb}' is not '${expectedTestDb}'`, () => {});
} else {
  const booking = () => new BookingService({} as WaitingRoomService, cacheStub);

  test("Late IPN (a): seat still AVAILABLE -> PAID, ticket and ORDER_PAID issued", async () => {
    const fx = await createLateFixture();
    await booking().cleanExpiredOrders();

    const before = await readState(fx.orderId);
    assert.equal(before.order?.status, OrderStatus.EXPIRED);

    const result = await ipnService(fx.transactionRef).process(fx.callback);
    assert.equal(result, "LATE_SUCCESS");

    const after = await readState(fx.orderId);
    assert.equal(after.order?.status, OrderStatus.PAID);
    assert.equal(after.transaction?.status, TransactionStatus.SUCCESS);
    assert.equal(after.issued.length, 1);
    assert.equal(after.issued[0]?.seatId, fx.seatId);
    assert.equal(after.paidEvents.length, 1);
    assert.equal(after.orderRefunds.length, 0);

    const [seat] = await db.select().from(seats).where(eq(seats.id, fx.seatId));
    assert.equal(seat?.status, SeatStatus.SOLD);
  });

  test("Late IPN (b): seat taken by someone else -> no ticket, 1 refund PENDING", async () => {
    const fx = await createLateFixture();
    await booking().cleanExpiredOrders();
    await takeSeatByAnotherBuyer(fx.seatId);

    const result = await ipnService(fx.transactionRef).process(fx.callback);
    assert.equal(result, "LATE_SUCCESS");

    const after = await readState(fx.orderId);
    assert.equal(after.order?.status, OrderStatus.EXPIRED);
    assert.equal(after.transaction?.status, TransactionStatus.SUCCESS);
    assert.equal(after.issued.length, 0);
    assert.equal(after.paidEvents.length, 0);

    assert.equal(after.orderRefunds.length, 1);
    assert.equal(after.orderRefunds[0]?.status, RefundStatus.PENDING);
    assert.equal(after.orderRefunds[0]?.reason, LATE_REFUND_REASON);
    assert.equal(after.orderRefunds[0]?.ticketId, null);

    // Ghe cua khach khac khong bi dong vao.
    const [seat] = await db.select().from(seats).where(eq(seats.id, fx.seatId));
    assert.equal(seat?.status, SeatStatus.SOLD);
  });

  test("Late IPN (c): called twice -> no extra ticket or refund", async () => {
    const issuedCase = await createLateFixture();
    const refundCase = await createLateFixture();
    await booking().cleanExpiredOrders();
    await takeSeatByAnotherBuyer(refundCase.seatId);

    for (const fx of [issuedCase, refundCase]) {
      const service = ipnService(fx.transactionRef);
      const first = await service.process(fx.callback);
      assert.equal(first, "LATE_SUCCESS");

      const second = await service.process(fx.callback);
      assert.notEqual(second, "LATE_SUCCESS");
    }

    const a = await readState(issuedCase.orderId);
    assert.equal(a.order?.status, OrderStatus.PAID);
    assert.equal(a.issued.length, 1);
    assert.equal(a.paidEvents.length, 1);
    assert.equal(a.orderRefunds.length, 0);

    const b = await readState(refundCase.orderId);
    assert.equal(b.order?.status, OrderStatus.EXPIRED);
    assert.equal(b.issued.length, 0);
    assert.equal(b.paidEvents.length, 0);
    assert.equal(b.orderRefunds.length, 1);
  });

  test("Late IPN (d): two concurrent IPNs -> exactly one ticket set", async () => {
    const fx = await createLateFixture();
    await booking().cleanExpiredOrders();

    const service = ipnService(fx.transactionRef);
    const results = await Promise.all([
      service.process(fx.callback),
      service.process(fx.callback),
    ]);

    assert.deepEqual([...results].sort(), [
      "ALREADY_PROCESSED",
      "LATE_SUCCESS",
    ]);

    const after = await readState(fx.orderId);
    assert.equal(after.order?.status, OrderStatus.PAID);
    assert.equal(after.issued.length, 1);
    assert.equal(after.paidEvents.length, 1);
    assert.equal(after.orderRefunds.length, 0);
  });
}
