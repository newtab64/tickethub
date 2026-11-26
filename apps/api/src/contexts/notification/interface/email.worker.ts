/**
 * Tien trinh worker BullMQ: gui email tu hang doi roi danh dau outbox COMPLETED.
 * Che do gui: EMAIL_WORKER_MODE = mock (mac dinh) | live-test | live.
 */
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { env } from "../../../config/env.config";
import { sqlClient } from "../../../database/db";
import { ProcessEmailJobUseCase } from "../application/process-email-job.use-case";
import { EMAIL_QUEUE_NAME } from "../domain/email.types";
import type { EmailJobData } from "../domain/email.types";
import { DrizzleOutboxStore } from "../infrastructure/drizzle-outbox.store";
import { ResendEmailSender } from "../infrastructure/resend-email.sender";

const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

const useCase = new ProcessEmailJobUseCase(
  new DrizzleOutboxStore(),
  new ResendEmailSender(),
  {
    // Doc moi lan chay de cau hinh doi tren moi truong duoc ap dung ngay
    get mode() {
      return process.env.EMAIL_WORKER_MODE ?? "mock";
    },
    get testEmailTo() {
      return process.env.TEST_EMAIL_TO;
    },
    get realEmailEnabled() {
      return process.env.ENABLE_REAL_EMAIL === "true";
    },
  },
  console,
);

const worker = new Worker<EmailJobData>(
  EMAIL_QUEUE_NAME,
  (job) => useCase.execute({ name: job.name, data: job.data }),
  { connection, concurrency: 1 },
);

worker.on("ready", () => {
  console.log("[Email Worker] Ready");
});

worker.on("completed", (job) => {
  console.log(`[Email Worker] Job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`[Email Worker] Job ${job?.id} failed: ${error.message}`);
});

worker.on("error", (error) => {
  console.error("[Email Worker] Error:", error.message);
});

async function shutdown() {
  await worker.close();
  await connection.quit();
  await sqlClient.end();
}

process.once("SIGINT", () => {
  void shutdown();
});

process.once("SIGTERM", () => {
  void shutdown();
});
