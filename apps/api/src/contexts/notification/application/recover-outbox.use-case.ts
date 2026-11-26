import { decideRecovery } from "../domain/recovery-decision";
import type {
  EmailJobQueue,
  Logger,
  OutboxStore,
} from "../domain/notification.ports";

export const STALE_AFTER_MS = 5 * 60 * 1000;

export interface RecoveryOptions {
  markFailed: boolean;
  targetId?: string | undefined;
}

export interface RecoveryResult {
  inspected: number;
  markedFailed: number;
  requiresReview: number;
}

/**
 * Kiem tra outbox USER_REGISTERED ket o PROCESSING. Mac dinh chi doc; che do
 * markFailed chi danh dau FAILED khi job BullMQ da het luot thu. Tuyet doi khong
 * tu dong gui lai email vi khong biet chac email da gui hay chua.
 */
export class RecoverOutboxUseCase {
  constructor(
    private readonly store: OutboxStore,
    private readonly queue: EmailJobQueue,
    private readonly logger: Logger,
  ) {}

  async run(options: RecoveryOptions): Promise<RecoveryResult> {
    this.logger.log("[Recovery] Checking stuck Outbox events...");
    this.logger.log(
      `[Recovery] Mode: ${options.markFailed ? "MARK FAILED" : "READ ONLY"}`,
    );

    const cutoff = new Date(Date.now() - STALE_AFTER_MS);
    const events = await this.store.findStaleProcessing({
      eventType: "USER_REGISTERED",
      olderThan: cutoff,
      onlyId: options.targetId,
      limit: 20,
    });
    this.logger.log(`[Recovery] Found ${events.length} stale events`);

    let markedFailed = 0;
    let requiresReview = 0;

    for (const event of events) {
      const jobId = `outbox_${event.id}`;
      try {
        const job = await this.queue.findJob(jobId);
        if (job && job.data?.outboxId !== event.id) {
          this.logger.warn(`[Recovery] Job/Outbox mismatch: ${event.id}`);
          requiresReview++;
          continue;
        }

        const jobState = job ? job.state : "missing";
        const attemptsMade = job?.attemptsMade ?? 0;
        const maxAttempts = Math.max(1, job?.maxAttempts ?? 1);
        const decision = decideRecovery(jobState, attemptsMade, maxAttempts);

        this.logger.log(`[Recovery] Decision: ${decision}`);
        this.logger.log("[Recovery] Details", {
          outboxId: event.id,
          outboxStatus: event.status,
          retryCount: event.retryCount,
          jobState,
          attemptsMade,
          maxAttempts,
          updatedAt: event.updatedAt,
        });

        if (decision === "WAIT") {
          this.logger.log(`[Recovery] Job ${jobId} is still managed by BullMQ`);
          continue;
        }

        if (decision !== "MARK_FAILED") {
          this.logger.warn(
            `[Recovery] Manual review required: ${jobId}, jobState=${jobState}`,
          );
          requiresReview++;
          continue;
        }

        if (!options.markFailed) {
          this.logger.warn(
            `[Recovery] ${jobId} exhausted retries. Use approved recovery procedure.`,
          );
          requiresReview++;
          continue;
        }

        // Doc lai trang thai job ngay truoc khi ghi
        const latest = await this.queue.findJob(jobId);
        if (!latest || latest.state !== "failed") {
          this.logger.warn(`[Recovery] Job state changed: ${jobId}`);
          requiresReview++;
          continue;
        }

        const updated = await this.store.markFailedIfUnchanged({
          event,
          olderThan: cutoff,
          errorMessage: `BullMQ job exhausted ${attemptsMade} attempts. Manual reconciliation required.`,
          now: new Date(),
        });
        if (updated) {
          markedFailed++;
          this.logger.log(`[Recovery] Outbox marked FAILED: ${event.id}`);
        } else {
          this.logger.warn(
            `[Recovery] Outbox changed concurrently: ${event.id}`,
          );
          requiresReview++;
        }
      } catch (error) {
        requiresReview++;
        this.logger.error(
          `[Recovery] Error inspecting ${event.id}:`,
          error instanceof Error ? error.message : "Unknown error",
        );
      }
    }

    this.logger.log("[Recovery] Finished", {
      inspected: events.length,
      markedFailed,
      requiresReview,
    });
    if (requiresReview > 0) {
      this.logger.warn("[Recovery] Some events require manual reconciliation.");
    }
    return { inspected: events.length, markedFailed, requiresReview };
  }
}
