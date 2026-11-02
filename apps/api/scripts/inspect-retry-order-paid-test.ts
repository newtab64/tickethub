/**
 * Inspect or retry exactly one FAILED BullMQ ORDER_PAID job in isolated W04 test.
 * Does not create a new job, change Outbox status, send email, or edit a user.
 * Retry requires --retry, a FAILED job and an explicit environment gate.
 */
import { isDeepStrictEqual } from "node:util";
import { eq } from "drizzle-orm";
import { OrderStatus, OutboxStatus, TicketStatus } from "@tickethub/shared";

import { env } from "../src/config/env.config";
import { db, sqlClient } from "../src/database/db";
import { orders, outbox, tickets, users } from "../src/database/schema";
import { emailQueue } from "../src/jobs/email.queue";
import { OrderPaidPayloadSchema } from "../src/jobs/email.types";

const OUTBOX_ID = "7a2df97c-7f7d-4540-a375-b46db47011b2";
const ORDER_CODE = "ORD-20261101-6219CE";
const TRANSACTION_REF = "BE20173330099D8F6473FA1E139";
const ORIGINAL_BUYER = "baamntk@gmail.com";
const TEST_RECEIVER = "nguyentuankhoi2603@gmail.com";

function localHost(host: string): boolean {
  return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(host);
}

function guard(): void {
  const databaseUrl = new URL(env.DATABASE_URL);
  const redisUrl = new URL(env.REDIS_URL);
  if (
    env.NODE_ENV !== "test" ||
    databaseUrl.pathname !== "/tickethub_w04_test" ||
    !localHost(databaseUrl.hostname) ||
    redisUrl.pathname !== "/15" ||
    !localHost(redisUrl.hostname) ||
    process.env.EMAIL_WORKER_MODE !== "live-test" ||
    process.env.ENABLE_ORDER_PAID_EMAIL_TEST !== "true" ||
    process.env.TEST_ORDER_PAID_OUTBOX_ID !== OUTBOX_ID ||
    process.env.TEST_EMAIL_TO?.trim().toLowerCase() !== TEST_RECEIVER
  ) {
    throw new Error(
      "Requires isolated W04 DB, Redis /15 and exact live-test email gates",
    );
  }
}

async function main(): Promise<void> {
  guard();
  const retry = process.argv.includes("--retry");
  if (
    process.argv.some(
      (arg) => arg !== "--retry" && arg !== "--inspect" && arg.includes("--"),
    )
  ) {
    throw new Error("Only --inspect or --retry are allowed");
  }

  const [event] = await db
    .select({
      id: outbox.id,
      eventType: outbox.eventType,
      payload: outbox.payload,
      status: outbox.status,
    })
    .from(outbox)
    .where(eq(outbox.id, OUTBOX_ID))
    .limit(1);
  if (!event || event.eventType !== "ORDER_PAID") {
    throw new Error("Expected ORDER_PAID outbox not found");
  }
  if (event.status === OutboxStatus.COMPLETED) {
    console.log("OUTBOX_COMPLETED: do not resend");
    return;
  }
  if (event.status !== OutboxStatus.PROCESSING) {
    throw new Error(
      `Unexpected Outbox status ${event.status}; do not retry automatically`,
    );
  }

  const payload = OrderPaidPayloadSchema.parse(event.payload);
  if (
    payload.orderCode !== ORDER_CODE ||
    payload.transactionRef !== TRANSACTION_REF
  ) {
    throw new Error("Transaction/order mismatch; refused");
  }
  const [[order], [user], orderTickets] = await Promise.all([
    db
      .select({ userId: orders.userId, status: orders.status })
      .from(orders)
      .where(eq(orders.id, payload.orderId))
      .limit(1),
    db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1),
    db
      .select({
        id: tickets.id,
        userId: tickets.userId,
        status: tickets.status,
      })
      .from(tickets)
      .where(eq(tickets.orderId, payload.orderId)),
  ]);
  if (
    !order ||
    order.status !== OrderStatus.PAID ||
    order.userId !== payload.userId ||
    !user ||
    user.email.trim().toLowerCase() !== ORIGINAL_BUYER ||
    orderTickets.length === 0 ||
    orderTickets.length !== payload.ticketIds.length ||
    orderTickets.some(
      (ticket) =>
        !payload.ticketIds.includes(ticket.id) ||
        ticket.userId !== payload.userId ||
        (ticket.status !== TicketStatus.SOLD &&
          ticket.status !== TicketStatus.CHECKED_IN),
    )
  ) {
    throw new Error("Order/BUYER/tickets do not match confirmed purchase");
  }

  const jobId = `outbox_${OUTBOX_ID}`;
  const job = await emailQueue.getJob(jobId);
  if (
    !job ||
    job.name !== "order-paid" ||
    job.data?.outboxId !== OUTBOX_ID ||
    job.data.eventType !== "ORDER_PAID" ||
    !isDeepStrictEqual(OrderPaidPayloadSchema.parse(job.data.payload), payload)
  ) {
    throw new Error(
      "Expected unchanged BullMQ job not found; manual review required",
    );
  }

  const state = await job.getState();
  console.log("[ORDER_PAID TEST JOB]", {
    outboxId: OUTBOX_ID,
    outboxStatus: event.status,
    jobId,
    jobState: state,
    attemptsMade: job.attemptsMade,
    configuredAttempts: job.opts.attempts ?? 1,
    targetEmail: TEST_RECEIVER,
  });

  if (!retry) return;
  if (process.env.ENABLE_TEST_EMAIL_JOB_RETRY !== "true") {
    throw new Error("Retry disabled: set ENABLE_TEST_EMAIL_JOB_RETRY=true");
  }
  if (state !== "failed") {
    throw new Error(`Cannot retry job in ${state} state; don't requeue`);
  }
  // Must be checked in the provider dashboard first: Resend 403 was rejected,
  // therefore no delivery was accepted for this Outbox in previous attempts.
  if (process.env.CONFIRMED_NO_RESEND_DELIVERY !== "true") {
    throw new Error(
      "Confirm no successful delivery for this Outbox in Resend first",
    );
  }
  // BullMQ 6 supports retrying the same stable job id without adding a new job.
  await job.retry("failed", { resetAttemptsMade: true });
  console.log(
    "[ORDER_PAID TEST JOB] RETRIED existing failed job; start live-test worker",
  );
}

void main()
  .catch((error: unknown) => {
    console.error(
      "[ORDER_PAID TEST JOB]",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await emailQueue.close();
    await sqlClient.end();
  });
