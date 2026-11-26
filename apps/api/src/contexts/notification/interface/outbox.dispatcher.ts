/**
 * Tien trinh CLI: dua outbox PENDING vao hang doi email.
 * Mac dinh la DRY RUN. Cac co: --enqueue, --enqueue-test, --enqueue-email-test,
 * --enqueue-review-test (kem --outbox-id=<UUID>).
 */
import { env } from "../../../config/env.config";
import { sqlClient } from "../../../database/db";
import { DispatchOutboxUseCase } from "../application/dispatch-outbox.use-case";
import {
  assertDispatchAllowed,
  parseDispatchArgs,
} from "../domain/dispatch-mode";
import { BullMqEmailQueue } from "../infrastructure/bullmq-email.queue";
import { DrizzleOutboxStore } from "../infrastructure/drizzle-outbox.store";

const queue = new BullMqEmailQueue();

async function main() {
  const options = parseDispatchArgs(process.argv);

  assertDispatchAllowed(options, {
    databaseName: new URL(env.DATABASE_URL).pathname.slice(1),
    redisDatabasePath: new URL(env.REDIS_URL).pathname,
    redisHostname: process.env.REDIS_URL
      ? new URL(process.env.REDIS_URL).hostname
      : null,
    flags: process.env,
  });

  const testEmail = process.env.TEST_EMAIL_TO?.trim().toLowerCase();
  const result = await new DispatchOutboxUseCase(
    new DrizzleOutboxStore(),
    queue,
    console,
  ).run(options, testEmail);

  if (result.failed > 0) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error("[Dispatcher] Fatal error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await queue.close();
    await sqlClient.end();
  });
