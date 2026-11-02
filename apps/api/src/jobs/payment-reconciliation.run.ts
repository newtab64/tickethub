import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { NestFactory } from "@nestjs/core";
import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import {
  OrderStatus,
  PaymentProvider,
  TransactionStatus,
} from "@tickethub/shared";
import { AppModule } from "../app.module";
import { env } from "../config/env.config";
import { db, sqlClient } from "../database/db";
import {
  orders,
  transactions,
  paymentReconciliations,
} from "../database/schema";
import { VnpayReconciliationService } from "../payments/vnpay-reconciliation.service";
import {
  classifyQueryDrDecision,
  FIRST_QUERY_DELAY_MS,
  MAX_QUERY_ATTEMPTS,
  queryDrRetryDelayMs,
} from "../payments/payment-reconciliation.policy";

const args = new Set(process.argv.slice(2));
const live = args.has("--live");
const once = args.has("--once") || !args.has("--loop");
const BATCH_SIZE = 20;
const targetRefArg = process.argv.slice(2).find((x) => x.startsWith("--ref="));
const targetRef = targetRefArg ? targetRefArg.slice("--ref=".length) : null;

function guard() {
  if (targetRef !== null && !/^BE2[0-9A-F]{24}$/.test(targetRef)) {
    throw new Error(
      "--ref must be a real BE2 VNPay reference (not IPNTEST/EMAILTEST)",
    );
  }
  const databaseUrl = new URL(env.DATABASE_URL);
  const redisUrl = new URL(env.REDIS_URL);
  const isLocal = (hostname: string) =>
    ["localhost", "127.0.0.1", "::1"].includes(hostname);
  const dbName = decodeURIComponent(databaseUrl.pathname.slice(1));
  if (
    env.NODE_ENV !== "test" ||
    !dbName.endsWith("_test") ||
    !isLocal(databaseUrl.hostname) ||
    !isLocal(redisUrl.hostname) ||
    redisUrl.pathname !== "/15" ||
    env.VNPAY_QUERYDR_URL !==
      "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction"
  )
    throw new Error(
      "2E QueryDR runner requires local isolated test DB, Redis /15 and VNPay sandbox",
    );
  if (live && process.env.ENABLE_VNPAY_QUERYDR_LIVE !== "true") {
    throw new Error(
      "Set ENABLE_VNPAY_QUERYDR_LIVE=true to enable real sandbox queries",
    );
  }
  if (args.has("--live") && args.has("--dry-run")) {
    throw new Error("Choose either --live or --dry-run");
  }
}

async function seedPending(now: Date): Promise<number> {
  const oldest = new Date(now.getTime() - FIRST_QUERY_DELAY_MS);
  const candidates = await db
    .select({ id: transactions.id, createdAt: transactions.createdAt })
    .from(transactions)
    .innerJoin(orders, eq(transactions.orderId, orders.id))
    .where(
      and(
        eq(transactions.provider, PaymentProvider.VNPAY),
        eq(transactions.status, TransactionStatus.PENDING),
        inArray(orders.status, [OrderStatus.PENDING, OrderStatus.EXPIRED]),
        lte(transactions.createdAt, oldest),
        sql`${transactions.vnpCreateDate} IS NOT NULL`,
        sql`${transactions.transactionRef} NOT LIKE 'IPNTEST%'`,
        sql`${transactions.transactionRef} NOT LIKE 'EMAILTEST%'`,
        targetRef ? eq(transactions.transactionRef, targetRef) : undefined,
      ),
    )
    .orderBy(asc(transactions.createdAt))
    .limit(100);
  for (const item of candidates) {
    await db
      .insert(paymentReconciliations)
      .values({
        transactionId: item.id,
        nextRunAt: new Date(item.createdAt.getTime() + FIRST_QUERY_DELAY_MS),
      })
      .onConflictDoNothing();
  }
  return candidates.length;
}

async function scanOnce(service: VnpayReconciliationService | null) {
  const now = new Date();
  // Dry-run is genuinely read-only: no insert/claim in PostgreSQL.
  const seeded = service ? await seedPending(now) : 0;
  if (service) {
    // A process could die after its final claim. Do not issue another request;
    // move the exhausted record to operator review once the lease expires.
    await db
      .update(paymentReconciliations)
      .set({
        status: "NEEDS_ATTENTION",
        lastDecision: "MAX_ATTEMPTS_OR_INTERRUPTED",
        leaseToken: null,
        leaseUntil: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(paymentReconciliations.status, "PENDING"),
          gte(paymentReconciliations.attemptCount, MAX_QUERY_ATTEMPTS),
          or(
            isNull(paymentReconciliations.leaseUntil),
            lte(paymentReconciliations.leaseUntil, now),
          ),
        ),
      );
  }
  const candidates = await db
    .select({
      id: transactions.id,
      ref: transactions.transactionRef,
      attempts: paymentReconciliations.attemptCount,
    })
    .from(paymentReconciliations)
    .innerJoin(
      transactions,
      eq(paymentReconciliations.transactionId, transactions.id),
    )
    .innerJoin(orders, eq(transactions.orderId, orders.id))
    .where(
      and(
        eq(paymentReconciliations.status, "PENDING"),
        lt(paymentReconciliations.attemptCount, MAX_QUERY_ATTEMPTS),
        lte(paymentReconciliations.nextRunAt, now),
        or(
          isNull(paymentReconciliations.leaseUntil),
          lte(paymentReconciliations.leaseUntil, now),
        ),
        eq(transactions.status, TransactionStatus.PENDING),
        inArray(orders.status, [OrderStatus.PENDING, OrderStatus.EXPIRED]),
        sql`${transactions.transactionRef} NOT LIKE 'IPNTEST%'`,
        sql`${transactions.transactionRef} NOT LIKE 'EMAILTEST%'`,
        targetRef ? eq(transactions.transactionRef, targetRef) : undefined,
      ),
    )
    .orderBy(asc(paymentReconciliations.nextRunAt))
    .limit(BATCH_SIZE);

  if (!service) {
    console.log("[2E QueryDR dry-run]", {
      seeded,
      due: candidates.length,
      items: candidates.map((x) => ({ ref: x.ref, attempt: x.attempts + 1 })),
    });
    return;
  }

  let done = 0;
  let retried = 0;
  let attention = 0;
  for (const item of candidates) {
    const token = randomUUID();
    const claimedAt = new Date();
    const [claimed] = await db
      .update(paymentReconciliations)
      .set({
        attemptCount: sql`${paymentReconciliations.attemptCount} + 1`,
        leaseToken: token,
        leaseUntil: new Date(claimedAt.getTime() + 90_000),
        // Durable cooldown is written BEFORE the external HTTP request.
        nextRunAt: new Date(claimedAt.getTime() + FIRST_QUERY_DELAY_MS),
        updatedAt: claimedAt,
      })
      .where(
        and(
          eq(paymentReconciliations.transactionId, item.id),
          eq(paymentReconciliations.status, "PENDING"),
          lt(paymentReconciliations.attemptCount, MAX_QUERY_ATTEMPTS),
          lte(paymentReconciliations.nextRunAt, claimedAt),
          or(
            isNull(paymentReconciliations.leaseUntil),
            lte(paymentReconciliations.leaseUntil, claimedAt),
          ),
        ),
      )
      .returning({ attemptCount: paymentReconciliations.attemptCount });
    if (!claimed) continue; // Another process claimed it.

    let decision = "QUERY_UNAVAILABLE";
    try {
      decision = await service.reconcile(item.ref, "127.0.0.1");
    } catch (error) {
      console.error("[2E QueryDR] provider/service error", {
        ref: item.ref,
        message: error instanceof Error ? error.message : "unknown",
      });
    }

    let next = classifyQueryDrDecision(decision);
    if (next === "RETRY" && claimed.attemptCount >= MAX_QUERY_ATTEMPTS) {
      next = "NEEDS_ATTENTION";
    }
    const delay = queryDrRetryDelayMs(claimed.attemptCount);
    await db
      .update(paymentReconciliations)
      .set({
        status:
          next === "DONE"
            ? "DONE"
            : next === "RETRY"
              ? "PENDING"
              : "NEEDS_ATTENTION",
        lastDecision: decision,
        nextRunAt: new Date(Date.now() + Math.max(FIRST_QUERY_DELAY_MS, delay)),
        leaseUntil: null,
        leaseToken: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(paymentReconciliations.transactionId, item.id),
          eq(paymentReconciliations.leaseToken, token),
        ),
      );
    if (next === "DONE") done++;
    else if (next === "RETRY") retried++;
    else {
      attention++;
      console.warn("[2E QueryDR] operator review required", {
        ref: item.ref,
        decision,
      });
    }
  }
  console.log("[2E QueryDR]", {
    seeded,
    due: candidates.length,
    done,
    retried,
    needsAttention: attention,
  });
}

async function main() {
  guard();
  const app = live
    ? await NestFactory.createApplicationContext(AppModule, { logger: false })
    : null;
  let stopping = false;
  process.once("SIGINT", () => {
    stopping = true;
  });
  process.once("SIGTERM", () => {
    stopping = true;
  });
  try {
    const service = app?.get(VnpayReconciliationService) ?? null;
    do {
      await scanOnce(service);
      if (!once && !stopping)
        await new Promise<void>((r) => setTimeout(r, 60_000));
    } while (!once && !stopping);
  } finally {
    await app?.close();
    await sqlClient.end();
  }
}
main().catch((error) => {
  console.error("[2E QueryDR]", error);
  process.exitCode = 1;
});
