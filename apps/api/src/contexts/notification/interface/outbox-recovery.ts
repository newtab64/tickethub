/**
 * Tien trinh CLI: kiem tra outbox USER_REGISTERED ket o PROCESSING.
 * Mac dinh chi doc. --mark-failed --outbox-id=<UUID> can ENABLE_OUTBOX_RECOVERY_WRITE=true
 * va OUTBOX_RECOVERY_APPROVED_ID trung voi outbox do.
 */
import { sqlClient } from "../../../database/db";
import { RecoverOutboxUseCase } from "../application/recover-outbox.use-case";
import {
  assertRecoveryWriteAllowed,
  parseRecoveryArgs,
} from "../domain/recovery-guard";
import { BullMqEmailQueue } from "../infrastructure/bullmq-email.queue";
import { DrizzleOutboxStore } from "../infrastructure/drizzle-outbox.store";

const queue = new BullMqEmailQueue();

async function main() {
  const request = parseRecoveryArgs(process.argv);
  assertRecoveryWriteAllowed(request, process.env);

  await new RecoverOutboxUseCase(new DrizzleOutboxStore(), queue, console).run(
    request,
  );
}

main()
  .catch((error: unknown) => {
    console.error("[Recovery] Fatal error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await queue.close();
    await sqlClient.end();
  });
