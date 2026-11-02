import { env } from "../config/env.config";
import { sqlClient } from "../database/db";
import { refundQueue } from "./refund.queue";
import {
  dispatchPendingRefunds,
  dispatchRefundReconciliations,
} from "./refund.dispatcher";

async function main() {
  const dbUrl = new URL(env.DATABASE_URL);
  const redisUrl = new URL(env.REDIS_URL);

  const dbName = decodeURIComponent(dbUrl.pathname.slice(1));

  const localDb = ["localhost", "127.0.0.1"].includes(dbUrl.hostname);

  const localRedis = ["localhost", "127.0.0.1"].includes(redisUrl.hostname);

  if (
    env.NODE_ENV !== "test" ||
    dbName !== "tickethub_w04_test" ||
    !localDb ||
    !localRedis ||
    redisUrl.pathname !== "/15"
  ) {
    throw new Error("Refund Dispatcher requires isolated W04 test environment");
  }

  // Keep the dispatcher alive: new late-IPN refunds are discovered each cycle.
  // The refund worker remains the only process permitted to send to VNPay.
  let stopping = false;
  process.once("SIGINT", () => {
    stopping = true;
  });
  process.once("SIGTERM", () => {
    stopping = true;
  });

  while (!stopping) {
    try {
      const sent = await dispatchPendingRefunds(50);
      const reconciliation = await dispatchRefundReconciliations(50);
      console.log("[Refund Dispatcher]", { sent, reconciliation });
    } catch (error) {
      console.error("[Refund Dispatcher] scan failed:", error);
    }
    // No overlapping cron scans; repeat roughly once a minute.
    if (!stopping)
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 60_000);
        timer.unref?.();
      });
  }
}

main()
  .catch((error) => {
    console.error("[Refund Dispatcher]", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await refundQueue.close();
    await sqlClient.end();
  });
