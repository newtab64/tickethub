import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { ConflictException, NotFoundException } from "@nestjs/common";
import { reserveRefundSend } from "../src/jobs/refund.processor";
import { and, eq, isNull, ne } from "drizzle-orm";

import {
  EventStatus,
  OrderStatus,
  PaymentProvider,
  RefundPolicyType,
  RefundStatus,
  TicketStatus,
  TransactionStatus,
  UserRole,
} from "@tickethub/shared";

import { env } from "../src/config/env.config";
import { db, sqlClient } from "../src/database/db";
import { lockTicketForCheckIn } from "../src/payments/refund-checkin.guard";
import { refundQueue } from "../src/jobs/refund.queue";
import {
  users,
  organizerProfiles,
  events,
  ticketTypes,
  orders,
  orderItems,
  transactions,
  tickets,
  refunds,
} from "../src/database/schema";

import { RefundRequestService } from "../src/payments/refund-request.service";
import { createHmac } from "node:crypto";
import { processRefundJob } from "../src/jobs/refund.processor";
import { dispatchRefundById } from "../src/jobs/refund.dispatcher";
const dbName = decodeURIComponent(new URL(env.DATABASE_URL).pathname.slice(1));

const safeTestDb = env.NODE_ENV === "test" && dbName === "tickethub_w04_test";

const service = new RefundRequestService();

async function createPaidFixture() {
  const [buyer] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, UserRole.BUYER))
    .limit(1);

  const [organizer] = await db
    .select({ id: organizerProfiles.id })
    .from(organizerProfiles)
    .limit(1);

  if (!buyer || !organizer) {
    throw new Error("Seed BUYER and organizer profile first");
  }

  const [otherUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(ne(users.id, buyer.id))
    .limit(1);

  if (!otherUser) {
    throw new Error("Second test user is required");
  }

  const id = randomUUID();
  const eventId = randomUUID();
  const ticketTypeId = randomUUID();
  const orderId = randomUUID();
  const ticketId = randomUUID();

  const now = new Date();
  const start = new Date(now.getTime() + 5 * 86_400_000);
  const end = new Date(start.getTime() + 2 * 3_600_000);

  await db.transaction(async (tx) => {
    await tx.insert(events).values({
      id: eventId,
      organizerId: organizer.id,
      title: "W04 Refund Integration Test",
      slug: `w04-refund-${id}`,
      description: "Isolated refund integration fixture",
      category: "Test",
      bannerUrl: "https://example.com/banner.png",
      venueName: "Test Venue",
      venueAddress: "Test Address",
      city: "HCM",
      startTime: start,
      endTime: end,
      gateOpeningTime: new Date(start.getTime() - 3_600_000),
      status: EventStatus.PUBLISHED,
      refundPolicyType: RefundPolicyType.FLEXIBLE,
      refundPolicyRules: [
        { minHoursBeforeStart: 168, refundPercent: 100 },
        { minHoursBeforeStart: 72, refundPercent: 70 },
        { minHoursBeforeStart: 0, refundPercent: 0 },
      ],
    });

    await tx.insert(ticketTypes).values({
      id: ticketTypeId,
      eventId,
      name: "GA Refund Test",
      price: "600000.00",
      capacity: 100,
      heldCount: 0,
      soldCount: 1,
      isSeated: false,
      saleStartTime: new Date(now.getTime() - 3_600_000),
      saleEndTime: new Date(start.getTime() - 3_600_000),
    });

    await tx.insert(orders).values({
      id: orderId,
      orderCode: `RF${id.replace(/-/g, "").slice(0, 20)}`,
      userId: buyer.id,
      eventId,
      totalAmount: "600000.00",
      finalAmount: "600000.00",
      status: OrderStatus.PAID,
      expiresAt: new Date(now.getTime() + 300_000),
      paidAt: now,
    });

    await tx.insert(orderItems).values({
      orderId,
      ticketTypeId,
      quantity: 1,
      unitPrice: "600000.00",
      subtotal: "600000.00",
    });

    await tx.insert(transactions).values({
      orderId,
      provider: PaymentProvider.VNPAY,
      transactionRef: `RFTEST${id.replace(/-/g, "")}`,
      amount: "600000.00",
      status: TransactionStatus.SUCCESS,
      idempotencyKey: `refund-fixture:${id}`,
    });

    await tx.insert(tickets).values({
      id: ticketId,
      ticketCode: `TKR${id.replace(/-/g, "").slice(0, 24)}`,
      orderId,
      userId: buyer.id,
      eventId,
      ticketTypeId,
      status: TicketStatus.SOLD,
    });
  });

  return {
    buyerId: buyer.id,
    otherUserId: otherUser.id,
    orderId,
    ticketId,
    ticketTypeId,
    eventId,
  };
}
type Fixture = Awaited<ReturnType<typeof createPaidFixture>>;

async function withFixture(run: (fixture: Fixture) => Promise<void>) {
  const f = await createPaidFixture();

  try {
    await run(f);
  } finally {
    await db.transaction(async (tx) => {
      await tx.delete(refunds).where(eq(refunds.orderId, f.orderId));
      await tx.delete(tickets).where(eq(tickets.orderId, f.orderId));
      await tx.delete(transactions).where(eq(transactions.orderId, f.orderId));
      await tx.delete(orderItems).where(eq(orderItems.orderId, f.orderId));
      await tx.delete(orders).where(eq(orders.id, f.orderId));
      await tx.delete(ticketTypes).where(eq(ticketTypes.id, f.ticketTypeId));
      await tx.delete(events).where(eq(events.id, f.eventId));
    });
  }
}

async function withPendingRefund(
  run: (refundId: string, fixture: Fixture) => Promise<void>,
) {
  await withFixture(async (f) => {
    // Refund Worker can ngay giao dich thanh toan goc.
    await db
      .update(transactions)
      .set({ vnpCreateDate: "20261030100000" })
      .where(eq(transactions.orderId, f.orderId));

    const created = await service.createFullOrderRefund({
      userId: f.buyerId,
      orderId: f.orderId,
      idempotencyKey: randomUUID(),
      reason: "W04 refund worker test",
    });

    assert.equal(created.status, RefundStatus.PENDING);

    await run(created.refundId, f);
  });
}

function makeSignedRefundResponse(
  request: Record<string, string>,
): Record<string, string> {
  const response: Record<string, string> = {
    vnp_ResponseId: "REFUNDTEST001",
    vnp_Command: "refund",
    vnp_ResponseCode: "00",
    vnp_Message: "Success",
    vnp_TmnCode: request.vnp_TmnCode,
    vnp_TxnRef: request.vnp_TxnRef,
    vnp_Amount: request.vnp_Amount,
    vnp_BankCode: "NCB",
    vnp_PayDate: "20261030220000",
    vnp_TransactionNo: "123456789",
    vnp_TransactionType: request.vnp_TransactionType,
    vnp_TransactionStatus: "00",
    vnp_OrderInfo: request.vnp_OrderInfo,
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
  ];

  const content = fields.map((field) => response[field] ?? "").join("|");

  response.vnp_SecureHash = createHmac("sha512", env.VNPAY_HASH_SECRET)
    .update(content, "utf8")
    .digest("hex");

  return response;
}

if (!safeTestDb) {
  test.skip(`W04 refund integration skipped: unsafe DB '${dbName}'`, () => {});
} else {
  test("W04: create refund PENDING for paid order", async () => {
    await withFixture(async (f) => {
      const result = await service.createFullOrderRefund({
        userId: f.buyerId,
        orderId: f.orderId,
        idempotencyKey: randomUUID(),
        reason: "Buyer requests cancellation",
      });

      assert.equal(result.status, RefundStatus.PENDING);
      assert.equal(result.idempotent, false);

      // 600000 VND * 70% = 420000 VND
      assert.equal(result.amount, "420000.00");

      const saved = await db
        .select()
        .from(refunds)
        .where(eq(refunds.orderId, f.orderId));

      assert.equal(saved.length, 1);
      assert.equal(saved[0]?.ticketId, null);

      // Tao request khong duoc huy ve ngay
      const [ticket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, f.ticketId));

      assert.equal(ticket?.status, TicketStatus.SOLD);

      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, f.orderId));

      assert.equal(order?.status, OrderStatus.PAID);
    });
  });

  test("W04: same Idempotency-Key returns existing refund", async () => {
    await withFixture(async (f) => {
      const input = {
        userId: f.buyerId,
        orderId: f.orderId,
        idempotencyKey: randomUUID(),
        reason: "Refund idempotency test",
      };

      const first = await service.createFullOrderRefund(input);
      const second = await service.createFullOrderRefund(input);

      assert.equal(first.refundId, second.refundId);
      assert.equal(first.idempotent, false);
      assert.equal(second.idempotent, true);

      const rows = await db
        .select()
        .from(refunds)
        .where(eq(refunds.orderId, f.orderId));

      assert.equal(rows.length, 1);
    });
  });

  test("W04: concurrent different keys create only one refund", async () => {
    await withFixture(async (f) => {
      const makeRequest = (key: string) =>
        service.createFullOrderRefund({
          userId: f.buyerId,
          orderId: f.orderId,
          idempotencyKey: key,
          reason: "Concurrent refund test",
        });

      const results = await Promise.allSettled([
        makeRequest(randomUUID()),
        makeRequest(randomUUID()),
      ]);

      const succeeded = results.filter((r) => r.status === "fulfilled");

      const failed = results.filter((r) => r.status === "rejected");

      assert.equal(succeeded.length, 1);
      assert.equal(failed.length, 1);

      const rows = await db
        .select()
        .from(refunds)
        .where(eq(refunds.orderId, f.orderId));

      assert.equal(rows.length, 1);
      assert.equal(rows[0]?.status, RefundStatus.PENDING);
    });
  });

  test("W04: another user cannot refund the order", async () => {
    await withFixture(async (f) => {
      await assert.rejects(
        () =>
          service.createFullOrderRefund({
            userId: f.otherUserId,
            orderId: f.orderId,
            idempotencyKey: randomUUID(),
            reason: "Unauthorized refund",
          }),
        (error: unknown) => error instanceof NotFoundException,
      );

      const rows = await db
        .select()
        .from(refunds)
        .where(eq(refunds.orderId, f.orderId));

      assert.equal(rows.length, 0);
    });
  });

  test("W04: checked-in ticket cannot be refunded", async () => {
    await withFixture(async (f) => {
      await db
        .update(tickets)
        .set({
          status: TicketStatus.CHECKED_IN,
          checkedInAt: new Date(),
        })
        .where(eq(tickets.id, f.ticketId));

      await assert.rejects(
        () =>
          service.createFullOrderRefund({
            userId: f.buyerId,
            orderId: f.orderId,
            idempotencyKey: randomUUID(),
            reason: "Checked-in refund test",
          }),
        (error: unknown) => error instanceof ConflictException,
      );
    });
  });

  test("W04: NO_REFUND policy rejects refund", async () => {
    await withFixture(async (f) => {
      await db
        .update(events)
        .set({
          refundPolicyType: RefundPolicyType.NO_REFUND,
        })
        .where(eq(events.id, f.eventId));

      await assert.rejects(
        () =>
          service.createFullOrderRefund({
            userId: f.buyerId,
            orderId: f.orderId,
            idempotencyKey: randomUUID(),
            reason: "No refund policy test",
          }),
        (error: unknown) => error instanceof ConflictException,
      );
    });
  });
}

after(async () => {
  console.log("[TEST CLEANUP] Closing Refund Queue...");
  await refundQueue.close();

  console.log("[TEST CLEANUP] Closing PostgreSQL...");
  await sqlClient.end();

  console.log("[TEST CLEANUP] All connections closed.");
});

test("W04: pending refund blocks ticket check-in", async () => {
  await withFixture(async (f) => {
    // 1. Tao refund PENDING
    await service.createFullOrderRefund({
      userId: f.buyerId,
      orderId: f.orderId,
      idempotencyKey: randomUUID(),
      reason: "Refund before check-in",
    });

    // 2. Thu check-in ve dang co refund
    await assert.rejects(
      () =>
        db.transaction(async (tx) => {
          await lockTicketForCheckIn(tx, f.ticketId);
        }),
      (error: unknown) => error instanceof ConflictException,
    );

    // 3. Ve khong duoc chuyen sang CHECKED_IN
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, f.ticketId));

    assert.equal(ticket?.status, TicketStatus.SOLD);
    assert.equal(ticket?.checkedInAt, null);
  });
});
test("W04: checked-in ticket blocks refund", async () => {
  await withFixture(async (f) => {
    // Chi gia lap buoc ghi Check-in.
    // Khong thay the viec xac thuc QR/Gate thuc te.
    await db.transaction(async (tx) => {
      const ticket = await lockTicketForCheckIn(tx, f.ticketId);

      const [updated] = await tx
        .update(tickets)
        .set({
          status: TicketStatus.CHECKED_IN,
          checkedInAt: new Date(),
        })
        .where(
          and(
            eq(tickets.id, ticket.id),
            eq(tickets.status, TicketStatus.SOLD),
            isNull(tickets.checkedInAt),
          ),
        )
        .returning();

      assert.ok(updated);
    });

    // Thu refund sau khi check-in
    await assert.rejects(
      () =>
        service.createFullOrderRefund({
          userId: f.buyerId,
          orderId: f.orderId,
          idempotencyKey: randomUUID(),
          reason: "Refund after check-in",
        }),
      (error: unknown) => error instanceof ConflictException,
    );

    const rows = await db
      .select()
      .from(refunds)
      .where(eq(refunds.orderId, f.orderId));

    assert.equal(rows.length, 0);
  });
});

test("W04: concurrent refund and check-in cannot both succeed", async () => {
  await withFixture(async (f) => {
    const refundRequest = () =>
      service.createFullOrderRefund({
        userId: f.buyerId,
        orderId: f.orderId,
        idempotencyKey: randomUUID(),
        reason: "Concurrent refund and check-in",
      });

    const checkInRequest = () =>
      db.transaction(async (tx) => {
        const ticket = await lockTicketForCheckIn(tx, f.ticketId);

        const [updated] = await tx
          .update(tickets)
          .set({
            status: TicketStatus.CHECKED_IN,
            checkedInAt: new Date(),
          })
          .where(
            and(
              eq(tickets.id, ticket.id),
              eq(tickets.status, TicketStatus.SOLD),
              isNull(tickets.checkedInAt),
            ),
          )
          .returning();

        assert.ok(updated);
        return updated;
      });

    // Hai luong chay dong thoi
    const results = await Promise.allSettled([
      refundRequest(),
      checkInRequest(),
    ]);

    const succeeded = results.filter((result) => result.status === "fulfilled");

    const failed = results.filter((result) => result.status === "rejected");

    assert.equal(succeeded.length, 1, "Only one operation can succeed");

    assert.equal(failed.length, 1);

    // Kiem tra database
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, f.ticketId));

    const refundRows = await db
      .select()
      .from(refunds)
      .where(eq(refunds.orderId, f.orderId));

    if (ticket?.status === TicketStatus.CHECKED_IN) {
      // Check-in thang: khong duoc tao Refund
      assert.equal(refundRows.length, 0);
    } else {
      // Refund thang: Ticket phai con SOLD
      assert.equal(ticket?.status, TicketStatus.SOLD);
      assert.equal(ticket?.checkedInAt, null);

      assert.equal(refundRows.length, 1);
      assert.equal(refundRows[0]?.status, RefundStatus.PENDING);
    }
  });
});

test("W04: concurrent refund workers reserve only once", async () => {
  await withFixture(async (f) => {
    // 1. Bo sung ngay giao dich VNPay goc.
    await db
      .update(transactions)
      .set({
        vnpCreateDate: "20261030100000",
      })
      .where(eq(transactions.orderId, f.orderId));

    // 2. Tao Refund PENDING.
    const created = await service.createFullOrderRefund({
      userId: f.buyerId,
      orderId: f.orderId,
      idempotencyKey: randomUUID(),
      reason: "W04 refund worker concurrency test",
    });

    assert.equal(created.status, RefundStatus.PENDING);

    // 3. Hai Worker cung claim mot Refund.
    const [first, second] = await Promise.all([
      reserveRefundSend(created.refundId),
      reserveRefundSend(created.refundId),
    ]);

    // Chi mot Worker duoc reserve thanh cong.
    const successfulReservations = [first, second].filter(
      (result) => result !== null,
    );

    assert.equal(
      successfulReservations.length,
      1,
      "Only one worker may reserve the refund",
    );

    // 4. Kiem tra trang thai PostgreSQL.
    const [refund] = await db
      .select()
      .from(refunds)
      .where(eq(refunds.id, created.refundId));

    assert.ok(refund);

    assert.equal(refund.status, RefundStatus.PROCESSING);

    assert.equal(refund.needsReconciliation, true);

    assert.ok(refund.providerRequestId, "Provider Request ID must be saved");

    assert.ok(refund.lastAttemptAt, "Last attempt time must be saved");

    assert.equal(refund.retryCount, 1, "Refund must be reserved once");

    // 5. Thu claim lan thu ba.
    const retry = await reserveRefundSend(created.refundId);

    assert.equal(
      retry,
      null,
      "Already processing refund must not be reserved again",
    );
  });
});

test("W04: refund timeout must not resend payment", async () => {
  await withPendingRefund(async (refundId) => {
    const originalFetch = globalThis.fetch;
    let httpCalls = 0;

    // Gia lap VNPay da nhan request,
    // nhung ket noi bi mat truoc khi co response.
    globalThis.fetch = async () => {
      httpCalls++;
      throw new Error("Simulated network timeout");
    };

    try {
      // Lan gui dau tien
      const first = await processRefundJob(refundId);

      assert.ok(
        "requiresReconciliation" in first && first.requiresReconciliation,
      );

      assert.equal(httpCalls, 1);

      const [refund] = await db
        .select()
        .from(refunds)
        .where(eq(refunds.id, refundId));

      assert.equal(refund?.status, RefundStatus.PROCESSING);
      assert.equal(refund?.needsReconciliation, true);
      assert.equal(refund?.errorMessage, "REFUND_HTTP_RESULT_UNKNOWN");

      assert.ok(refund?.providerRequestId);

      // Gia lap BullMQ thuc thi lai job
      const second = await processRefundJob(refundId);

      assert.deepEqual(second, {
        skipped: true,
        reason: "NOT_PENDING",
      });

      // Tuyet doi khong gui refund lan 2
      assert.equal(httpCalls, 1, "Refund HTTP must be called exactly once");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("W04: invalid refund signature requires reconciliation", async () => {
  await withPendingRefund(async (refundId, f) => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (_url, options) => {
      const request = JSON.parse(String(options?.body)) as Record<
        string,
        string
      >;

      const response = makeSignedRefundResponse(request);

      // Sua so tien SAU khi ky HMAC.
      response.vnp_Amount = "99999999";

      return new Response(JSON.stringify(response), {
        status: 200,
      });
    };

    try {
      const result = await processRefundJob(refundId);

      assert.ok(
        "requiresReconciliation" in result && result.requiresReconciliation,
      );

      const [refund] = await db
        .select()
        .from(refunds)
        .where(eq(refunds.id, refundId));

      assert.equal(refund?.status, RefundStatus.PROCESSING);
      assert.equal(refund?.needsReconciliation, true);

      // Ve van phai con SOLD.
      const [ticket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, f.ticketId));

      assert.equal(ticket?.status, TicketStatus.SOLD);

      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, f.orderId));

      assert.equal(order?.status, OrderStatus.PAID);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("W04: successful refund completes and cancels tickets once", async () => {
  await withPendingRefund(async (refundId, f) => {
    const originalFetch = globalThis.fetch;
    let httpCalls = 0;

    globalThis.fetch = async (_url, options) => {
      httpCalls++;

      assert.equal(options?.method, "POST");

      const request = JSON.parse(String(options?.body)) as Record<
        string,
        string
      >;

      // Fixture: 600000 VND, refund 70% = 420000 VND.
      assert.equal(request.vnp_Amount, "42000000");
      assert.equal(request.vnp_TransactionType, "03");

      const response = makeSignedRefundResponse(request);

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    };

    try {
      const result = await processRefundJob(refundId);

      assert.ok("completed" in result && result.completed);

      assert.equal(httpCalls, 1);

      // Refund COMPLETED
      const [refund] = await db
        .select()
        .from(refunds)
        .where(eq(refunds.id, refundId));

      assert.equal(refund?.status, RefundStatus.COMPLETED);
      assert.equal(refund?.needsReconciliation, false);
      assert.equal(refund?.amount, "420000.00");
      assert.ok(refund?.processedAt);

      // Ticket CANCELLED
      const [ticket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, f.ticketId));

      assert.equal(ticket?.status, TicketStatus.CANCELLED);

      // Hoan 70%, chua phai hoan 100% so tien.
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, f.orderId));

      assert.equal(order?.status, OrderStatus.PAID);

      // Worker chay lai: khong gui Refund lan 2
      const retry = await processRefundJob(refundId);

      assert.deepEqual(retry, {
        skipped: true,
        reason: "NOT_PENDING",
      });

      assert.equal(httpCalls, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("W04: dispatcher restores missing pending refund job", async () => {
  await withPendingRefund(async (refundId) => {
    const jobId = `refund_${refundId}`;

    // Chi duoc thuc hien khi Refund Worker da tat
    // va su dung Redis test rieng.
    await refundQueue.remove(jobId);

    assert.equal(await refundQueue.getJobState(jobId), "unknown");

    // Dispatcher phuc hoi job
    const result = await dispatchRefundById(refundId);

    assert.equal(result, "ENQUEUED");

    const job = await refundQueue.getJob(jobId);

    assert.ok(job);
    assert.equal(job.data.refundId, refundId);

    // Goi dispatcher lan nua khong tao job moi
    const second = await dispatchRefundById(refundId);

    assert.equal(second, "ALREADY_QUEUED");
  });
});

test("W04: dispatcher never resends processing refund", async () => {
  await withPendingRefund(async (refundId) => {
    // Claim refund trong database
    const reserved = await reserveRefundSend(refundId);

    assert.ok(reserved);

    const [before] = await db
      .select()
      .from(refunds)
      .where(eq(refunds.id, refundId));

    assert.equal(before.status, RefundStatus.PROCESSING);
    assert.equal(before.needsReconciliation, true);

    // Gia lap job khong con trong Redis test.
    // Worker phai duoc tat khi chay test.
    const jobId = `refund_${refundId}`;
    await refundQueue.remove(jobId);

    const result = await dispatchRefundById(refundId);

    assert.equal(result, "SKIPPED_DB");

    // Dispatcher khong duoc tao lai job.
    assert.equal(await refundQueue.getJobState(jobId), "unknown");

    const [after] = await db
      .select()
      .from(refunds)
      .where(eq(refunds.id, refundId));

    assert.equal(after.status, RefundStatus.PROCESSING);
    assert.equal(after.retryCount, 1);
  });
});
