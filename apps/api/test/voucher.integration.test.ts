import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { BadRequestException, ConflictException } from "@nestjs/common";

import {
  EventStatus,
  OrderStatus,
  PaymentProvider,
  TransactionStatus,
} from "@tickethub/shared";

import { BookingService } from "../src/booking/booking.service";
import type { WaitingRoomService } from "../src/waiting-room/waiting-room.service";
import type { EventReadCacheService } from "../src/events/event-read-cache.service";
import { PaymentSettlementService } from "../src/payments/payment-settlement.service";
import { VnpayIpnService } from "../src/payments/vnpay-ipn.service";
import { toVnpayAmount } from "../src/payments/vnpay-amount";
import { env } from "../src/config/env.config";
import { db } from "../src/database/db";
import {
  users,
  events,
  orders,
  ticketTypes,
  transactions,
  vouchers,
  voucherRedemptions,
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

const booking = () => new BookingService({} as WaitingRoomService, cacheStub);

// Ve GA dang mo ban, su kien PUBLISHED, khong bat hang cho ao, con it nhat 3 cho.
async function findSellableGaType() {
  const now = new Date();
  const [row] = await db
    .select({ tt: ticketTypes })
    .from(ticketTypes)
    .innerJoin(events, eq(events.id, ticketTypes.eventId))
    .where(
      and(
        eq(ticketTypes.isSeated, false),
        eq(events.status, EventStatus.PUBLISHED),
        eq(events.isWaitingRoomEnabled, false),
        lte(ticketTypes.saleStartTime, now),
        gte(ticketTypes.saleEndTime, now),
        sql`${ticketTypes.capacity} - ${ticketTypes.soldCount} - ${ticketTypes.heldCount} >= 3`,
      ),
    )
    .limit(1);
  return row?.tt;
}

async function createVoucher(
  eventId: string,
  overrides: Partial<typeof vouchers.$inferInsert> = {},
) {
  const [voucher] = await db
    .insert(vouchers)
    .values({
      code: `T${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`,
      eventId,
      discountType: "PERCENT",
      discountValue: "10.00",
      minOrderAmount: "0.00",
      maxUses: null,
      startsAt: new Date(Date.now() - 3_600_000),
      endsAt: new Date(Date.now() + 86_400_000),
      isActive: true,
      ...overrides,
    })
    .returning();
  assert.ok(voucher);
  return voucher;
}

const vnd = (numeric: string): bigint => BigInt(numeric.split(".")[0]!);

async function redemptionOf(orderId: string) {
  const [row] = await db
    .select()
    .from(voucherRedemptions)
    .where(eq(voucherRedemptions.orderId, orderId));
  return row;
}

async function heldCountOf(ticketTypeId: string) {
  const [row] = await db
    .select({ held: ticketTypes.heldCount })
    .from(ticketTypes)
    .where(eq(ticketTypes.id, ticketTypeId));
  return row?.held;
}

if (!isSafeTestDb) {
  test.skip(`Voucher tests skipped: '${targetDb}' is not '${expectedTestDb}'`, () => {});
} else {
  test("Voucher PERCENT 10%: finalAmount reduced, 1 RESERVED row", async () => {
    const tt = await findSellableGaType();
    assert.ok(tt, "Seed needs a sellable GA ticket type");
    const [user] = await db.select({ id: users.id }).from(users).limit(1);
    assert.ok(user);
    const voucher = await createVoucher(tt.eventId);

    const held = await heldCountOf(tt.id);
    const result = await booking().holdSeats(user.id, {
      eventId: tt.eventId,
      items: [{ ticketTypeId: tt.id, quantity: 1 }],
      voucherCode: voucher.code,
    });

    const subtotal = vnd(tt.price);
    const discount = (subtotal * 10n) / 100n;
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, result.orderId));

    assert.equal(vnd(order!.totalAmount), subtotal);
    assert.equal(vnd(order!.discountAmount), discount);
    assert.equal(vnd(order!.finalAmount), subtotal - discount);
    assert.equal(order!.voucherCode, voucher.code);
    assert.equal(result.finalAmount, Number(subtotal - discount));

    const redemption = await redemptionOf(result.orderId);
    assert.equal(redemption?.status, "RESERVED");
    assert.equal(redemption?.voucherId, voucher.id);

    // releaseHold nha voucher va tra cho giu.
    await booking().releaseHold(user.id, result.orderId);
    assert.equal((await redemptionOf(result.orderId))?.status, "RELEASED");
    assert.equal(await heldCountOf(tt.id), held);
  });

  test("Voucher maxUses=1: two concurrent holds, exactly one wins", async () => {
    const tt = await findSellableGaType();
    assert.ok(tt, "Seed needs a sellable GA ticket type");
    const [user] = await db.select({ id: users.id }).from(users).limit(1);
    assert.ok(user);
    const voucher = await createVoucher(tt.eventId, { maxUses: 1 });

    const dto = {
      eventId: tt.eventId,
      items: [{ ticketTypeId: tt.id, quantity: 1 }],
      voucherCode: voucher.code,
    };

    const results = await Promise.allSettled([
      booking().holdSeats(user.id, dto),
      booking().holdSeats(user.id, dto),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.ok(
      (rejected[0] as PromiseRejectedResult).reason instanceof
        ConflictException,
    );

    const rows = await db
      .select()
      .from(voucherRedemptions)
      .where(eq(voucherRedemptions.voucherId, voucher.id));
    assert.equal(rows.length, 1);

    const winner = (fulfilled[0] as PromiseFulfilledResult<{ orderId: string }>)
      .value;
    await booking().releaseHold(user.id, winner.orderId);
  });

  test("Voucher below minOrderAmount is rejected, nothing held", async () => {
    const tt = await findSellableGaType();
    assert.ok(tt, "Seed needs a sellable GA ticket type");
    const [user] = await db.select({ id: users.id }).from(users).limit(1);
    assert.ok(user);
    const voucher = await createVoucher(tt.eventId, {
      minOrderAmount: `${vnd(tt.price) + 1000n}.00`,
    });

    const held = await heldCountOf(tt.id);
    await assert.rejects(
      booking().holdSeats(user.id, {
        eventId: tt.eventId,
        items: [{ ticketTypeId: tt.id, quantity: 1 }],
        voucherCode: voucher.code,
      }),
      BadRequestException,
    );
    assert.equal(await heldCountOf(tt.id), held);
  });

  test("100% discount is rejected (VNPay cannot take 0 VND), hold rolled back", async () => {
    const tt = await findSellableGaType();
    assert.ok(tt, "Seed needs a sellable GA ticket type");
    const [user] = await db.select({ id: users.id }).from(users).limit(1);
    assert.ok(user);
    const voucher = await createVoucher(tt.eventId, {
      discountType: "FIXED",
      discountValue: `${vnd(tt.price)}.00`,
    });

    const held = await heldCountOf(tt.id);
    await assert.rejects(
      booking().holdSeats(user.id, {
        eventId: tt.eventId,
        items: [{ ticketTypeId: tt.id, quantity: 1 }],
        voucherCode: voucher.code,
      }),
      BadRequestException,
    );
    assert.equal(await heldCountOf(tt.id), held);
  });

  test("Expired order without payment: cleanup RELEASES the voucher", async () => {
    const tt = await findSellableGaType();
    assert.ok(tt, "Seed needs a sellable GA ticket type");
    const [user] = await db.select({ id: users.id }).from(users).limit(1);
    assert.ok(user);
    const voucher = await createVoucher(tt.eventId);

    const result = await booking().holdSeats(user.id, {
      eventId: tt.eventId,
      items: [{ ticketTypeId: tt.id, quantity: 1 }],
      voucherCode: voucher.code,
    });

    await db
      .update(orders)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(orders.id, result.orderId));

    await booking().cleanExpiredOrders();

    assert.equal((await redemptionOf(result.orderId))?.status, "RELEASED");
  });

  test("Expired order WITH payment attempt keeps voucher RESERVED", async () => {
    const tt = await findSellableGaType();
    assert.ok(tt, "Seed needs a sellable GA ticket type");
    const [user] = await db.select({ id: users.id }).from(users).limit(1);
    assert.ok(user);
    const voucher = await createVoucher(tt.eventId);

    const result = await booking().holdSeats(user.id, {
      eventId: tt.eventId,
      items: [{ ticketTypeId: tt.id, quantity: 1 }],
      voucherCode: voucher.code,
    });

    await db.insert(transactions).values({
      orderId: result.orderId,
      provider: PaymentProvider.VNPAY,
      transactionRef: `VCH${randomUUID().replace(/-/g, "")}`,
      amount: `${result.finalAmount}.00`,
      status: TransactionStatus.PENDING,
      idempotencyKey: `voucher-test:${randomUUID()}`,
    });
    await db
      .update(orders)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(orders.id, result.orderId));

    await booking().cleanExpiredOrders();

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, result.orderId));
    assert.equal(order?.status, OrderStatus.EXPIRED);
    assert.equal((await redemptionOf(result.orderId))?.status, "RESERVED");
  });

  // Test nay chi pass SAU KHI settle() co doan RESERVED -> REDEEMED (xem ghi chu).
  test("Successful IPN turns voucher RESERVED into REDEEMED", async () => {
    const tt = await findSellableGaType();
    assert.ok(tt, "Seed needs a sellable GA ticket type");
    const [user] = await db.select({ id: users.id }).from(users).limit(1);
    assert.ok(user);
    const voucher = await createVoucher(tt.eventId);

    const result = await booking().holdSeats(user.id, {
      eventId: tt.eventId,
      items: [{ ticketTypeId: tt.id, quantity: 1 }],
      voucherCode: voucher.code,
    });

    const transactionRef = `VCH${randomUUID().replace(/-/g, "")}`;
    const amount = `${result.finalAmount}.00`;
    await db.insert(transactions).values({
      orderId: result.orderId,
      provider: PaymentProvider.VNPAY,
      transactionRef,
      amount,
      status: TransactionStatus.PENDING,
      idempotencyKey: `voucher-test:${randomUUID()}`,
    });

    const service = new VnpayIpnService(
      new PaymentSettlementService(cacheStub),
    );
    Object.defineProperty(service, "gateway", {
      value: {
        verifyCallback: () => ({
          verified: true,
          success: true,
          transactionRef,
          providerTransactionId: "VOUCHERPROVIDER",
        }),
      },
    });

    const decision = await service.process({
      vnp_Amount: toVnpayAmount(amount)!,
      vnp_ResponseCode: "00",
      vnp_TransactionStatus: "00",
    });

    assert.equal(decision, "APPLY_SUCCESS");
    assert.equal((await redemptionOf(result.orderId))?.status, "REDEEMED");
  });
}
