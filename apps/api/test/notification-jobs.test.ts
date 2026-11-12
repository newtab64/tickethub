import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { OutboxStatus } from "@tickethub/shared";
import { DispatchOutboxUseCase } from "../src/contexts/notification/application/dispatch-outbox.use-case";
import {
  ProcessEmailJobUseCase,
  type EmailWorkerConfig,
} from "../src/contexts/notification/application/process-email-job.use-case";
import { RecoverOutboxUseCase } from "../src/contexts/notification/application/recover-outbox.use-case";
import {
  assertDispatchAllowed,
  parseDispatchArgs,
  type DispatchEnvironment,
} from "../src/contexts/notification/domain/dispatch-mode";
import {
  assertRecoveryWriteAllowed,
  parseRecoveryArgs,
} from "../src/contexts/notification/domain/recovery-guard";
import type {
  EmailJobQueue,
  EmailSender,
  Logger,
  OutboxStore,
  PendingOutboxEvent,
  QueuedEmailJob,
  StaleOutboxEvent,
  StoredOutboxEvent,
} from "../src/contexts/notification/domain/notification.ports";

const silent: Logger = { log() {}, warn() {}, error() {} };

const registration = (email = "a@b.vn") => ({
  userId: randomUUID(),
  email,
  fullName: "A",
  verificationToken: "tok",
});

class FakeStore implements OutboxStore {
  pending: PendingOutboxEvent[] = [];
  stored = new Map<string, StoredOutboxEvent>();
  stale: StaleOutboxEvent[] = [];
  claimable = true;
  claimed: string[] = [];
  released: Array<{ id: string; retryCount: number }> = [];
  completed: string[] = [];
  failedMarked: string[] = [];
  completeResult = true;
  markFailedResult = true;
  lastFilter: unknown;

  async findPending(filter: unknown) {
    this.lastFilter = filter;
    return this.pending;
  }
  async claim(id: string) {
    if (!this.claimable) return false;
    this.claimed.push(id);
    return true;
  }
  async releaseForRetry(i: { id: string; retryCount: number }) {
    this.released.push({ id: i.id, retryCount: i.retryCount });
  }
  async findById(id: string) {
    return this.stored.get(id) ?? null;
  }
  async complete(id: string) {
    if (this.completeResult) this.completed.push(id);
    return this.completeResult;
  }
  async findStaleProcessing() {
    return this.stale;
  }
  async markFailedIfUnchanged(i: { event: StaleOutboxEvent }) {
    if (this.markFailedResult) this.failedMarked.push(i.event.id);
    return this.markFailedResult;
  }
}

class FakeQueue implements EmailJobQueue {
  jobs = new Map<string, QueuedEmailJob>();
  enqueued: string[] = [];
  failEnqueue = false;
  async findJob(jobId: string) {
    return this.jobs.get(jobId) ?? null;
  }
  async enqueueRegistration(outboxId: string) {
    if (this.failEnqueue) throw new Error("redis down");
    this.enqueued.push(outboxId);
    return { id: `outbox_${outboxId}` };
  }
  async enqueueReview(outboxId: string) {
    if (this.failEnqueue) throw new Error("redis down");
    this.enqueued.push(outboxId);
    return { id: `outbox_${outboxId}` };
  }
  async enqueueRefundNotice(outboxId: string) {
    if (this.failEnqueue) throw new Error("redis down");
    this.enqueued.push(outboxId);
    return { id: `outbox_${outboxId}` };
  }
}

const baseEnv: DispatchEnvironment = {
  databaseName: "tickethub_test",
  redisDatabasePath: "/15",
  redisHostname: "email-test-redis",
  flags: {},
};

describe("dispatch mode guards", () => {
  it("allows a single enqueue mode and a single outbox id", () => {
    assert.equal(parseDispatchArgs([]).mode, "DRY_RUN");
    assert.equal(parseDispatchArgs(["--enqueue"]).mode, "LIVE_ENQUEUE");
    assert.throws(() => parseDispatchArgs(["--enqueue", "--enqueue-test"]));
    assert.throws(() => parseDispatchArgs(["--outbox-id=a", "--outbox-id=b"]));
    assert.equal(parseDispatchArgs(["--outbox-id=abc"]).targetOutboxId, "abc");
  });

  it("blocks live enqueue unless explicitly enabled", () => {
    const opts = parseDispatchArgs(["--enqueue"]);
    assert.throws(() => assertDispatchAllowed(opts, baseEnv));
    assert.doesNotThrow(() =>
      assertDispatchAllowed(opts, {
        ...baseEnv,
        flags: { ENABLE_REAL_EMAIL_DISPATCH: "true" },
      }),
    );
  });

  it("requires an isolated environment for the review email test", () => {
    const id = randomUUID();
    const opts = parseDispatchArgs([
      "--enqueue-review-test",
      `--outbox-id=${id}`,
    ]);
    const flags = {
      ENABLE_REVIEW_EMAIL_TEST: "true",
      EMAIL_WORKER_MODE: "live-test",
      TEST_EMAIL_TO: "me@x.vn",
    };
    assert.doesNotThrow(() =>
      assertDispatchAllowed(opts, { ...baseEnv, flags }),
    );
    assert.throws(() =>
      assertDispatchAllowed(opts, {
        ...baseEnv,
        databaseName: "tickethub_dev",
        flags,
      }),
    );
    assert.throws(() =>
      assertDispatchAllowed(opts, {
        ...baseEnv,
        redisDatabasePath: "/0",
        flags,
      }),
    );
    assert.throws(() =>
      assertDispatchAllowed(parseDispatchArgs(["--enqueue-review-test"]), {
        ...baseEnv,
        flags,
      }),
    );
  });

  it("requires the isolated redis for the registration email test", () => {
    const opts = parseDispatchArgs(["--enqueue-email-test"]);
    const flags = {
      ENABLE_TEST_EMAIL_DISPATCH: "true",
      EMAIL_WORKER_MODE: "live-test",
      TEST_EMAIL_TO: "me@x.vn",
    };
    assert.doesNotThrow(() =>
      assertDispatchAllowed(opts, { ...baseEnv, flags }),
    );
    assert.throws(() =>
      assertDispatchAllowed(opts, {
        ...baseEnv,
        redisHostname: "localhost",
        flags,
      }),
    );
  });
});

describe("DispatchOutboxUseCase", () => {
  const event = (id = randomUUID(), payload: unknown = registration()) => ({
    id,
    eventType: "USER_REGISTERED",
    payload,
    retryCount: 0,
  });

  it("only validates in DRY_RUN, claiming and enqueueing nothing", async () => {
    const store = new FakeStore();
    const queue = new FakeQueue();
    store.pending = [event()];
    const res = await new DispatchOutboxUseCase(store, queue, silent).run(
      { mode: "DRY_RUN" },
      undefined,
    );
    assert.deepEqual(res, { found: 1, failed: 0 });
    assert.equal(store.claimed.length, 0);
    assert.equal(queue.enqueued.length, 0);
  });

  it("claims then enqueues in live mode and asks for a limit of 10", async () => {
    const store = new FakeStore();
    const queue = new FakeQueue();
    const e = event();
    store.pending = [e];
    await new DispatchOutboxUseCase(store, queue, silent).run(
      { mode: "LIVE_ENQUEUE" },
      undefined,
    );
    assert.deepEqual(store.claimed, [e.id]);
    assert.deepEqual(queue.enqueued, [e.id]);
    assert.equal((store.lastFilter as { limit: number }).limit, 10);
  });

  it("skips events that already have a queue job or were claimed elsewhere", async () => {
    const store = new FakeStore();
    const queue = new FakeQueue();
    const dup = event();
    queue.jobs.set(`outbox_${dup.id}`, {
      data: undefined,
      state: "waiting",
      attemptsMade: 0,
      maxAttempts: 3,
    });
    store.pending = [dup];
    await new DispatchOutboxUseCase(store, queue, silent).run(
      { mode: "LIVE_ENQUEUE" },
      undefined,
    );
    assert.equal(store.claimed.length, 0);

    queue.jobs.clear();
    store.claimable = false;
    await new DispatchOutboxUseCase(store, queue, silent).run(
      { mode: "LIVE_ENQUEUE" },
      undefined,
    );
    assert.equal(queue.enqueued.length, 0);
  });

  it("releases the outbox for retry when enqueue fails and reports the failure", async () => {
    const store = new FakeStore();
    const queue = new FakeQueue();
    queue.failEnqueue = true;
    const e = { ...event(), retryCount: 2 };
    store.pending = [e];
    const res = await new DispatchOutboxUseCase(store, queue, silent).run(
      { mode: "LIVE_ENQUEUE" },
      undefined,
    );
    assert.equal(res.failed, 1);
    assert.deepEqual(store.released, [{ id: e.id, retryCount: 3 }]);
  });

  it("counts invalid payloads and unsupported types as failures", async () => {
    const store = new FakeStore();
    const queue = new FakeQueue();
    store.pending = [
      event(randomUUID(), { nope: true }),
      { ...event(), eventType: "REFUND_REQUESTED" },
    ];
    const res = await new DispatchOutboxUseCase(store, queue, silent).run(
      { mode: "LIVE_ENQUEUE" },
      undefined,
    );
    assert.equal(res.failed, 2);
    assert.equal(store.claimed.length, 0);
  });

  it("limits the registration email test to the configured recipient", async () => {
    const store = new FakeStore();
    const queue = new FakeQueue();
    const mine = event(randomUUID(), registration("Me@X.vn"));
    const other = event(randomUUID(), registration("other@x.vn"));
    store.pending = [mine, other];
    await new DispatchOutboxUseCase(store, queue, silent).run(
      { mode: "EMAIL_TEST" },
      "me@x.vn",
    );
    assert.deepEqual(queue.enqueued, [mine.id]);
    assert.equal(
      (store.lastFilter as { onlyEmail: string }).onlyEmail,
      "me@x.vn",
    );
  });

  it("only sends the smoke fixture in TEST_ENQUEUE mode", async () => {
    const store = new FakeStore();
    const queue = new FakeQueue();
    const smoke = event(randomUUID(), {
      ...registration("outbox-smoke@example.invalid"),
      verificationToken: "fake-test-token",
    });
    store.pending = [smoke, event()];
    await new DispatchOutboxUseCase(store, queue, silent).run(
      { mode: "TEST_ENQUEUE" },
      undefined,
    );
    assert.deepEqual(queue.enqueued, [smoke.id]);
  });
});

describe("refund notice emails", () => {
  const notice = () => ({
    orderId: randomUUID(),
    orderCode: "TH123",
    userId: randomUUID(),
    email: "buyer@example.com",
    fullName: "Buyer",
    amount: "500000.00",
  });

  it("dispatches PAYMENT_EXPIRED_REFUND_NOTICE events in live mode", async () => {
    const store = new FakeStore();
    const queue = new FakeQueue();
    const e = {
      id: randomUUID(),
      eventType: "PAYMENT_EXPIRED_REFUND_NOTICE",
      payload: notice(),
      retryCount: 0,
    };
    store.pending = [e];
    const res = await new DispatchOutboxUseCase(store, queue, silent).run(
      { mode: "LIVE_ENQUEUE" },
      undefined,
    );
    assert.deepEqual(res, { found: 1, failed: 0 });
    assert.deepEqual(queue.enqueued, [e.id]);
    assert.ok(
      (store.lastFilter as { eventTypes: string[] }).eventTypes.includes(
        "PAYMENT_EXPIRED_REFUND_NOTICE",
      ),
    );
  });

  it("never enqueues refund notices in the registration or review test modes", async () => {
    for (const mode of ["EMAIL_TEST", "TEST_ENQUEUE", "REVIEW_TEST"] as const) {
      const store = new FakeStore();
      const queue = new FakeQueue();
      store.pending = [
        {
          id: randomUUID(),
          eventType: "PAYMENT_EXPIRED_REFUND_NOTICE",
          payload: notice(),
          retryCount: 0,
        },
      ];
      await new DispatchOutboxUseCase(store, queue, silent).run(
        { mode },
        "buyer@example.com",
      );
      assert.equal(queue.enqueued.length, 0, mode);
    }
  });

  it("rejects an invalid notice payload", async () => {
    const store = new FakeStore();
    const queue = new FakeQueue();
    store.pending = [
      {
        id: randomUUID(),
        eventType: "PAYMENT_EXPIRED_REFUND_NOTICE",
        payload: { email: "not-an-email" },
        retryCount: 0,
      },
    ];
    const res = await new DispatchOutboxUseCase(store, queue, silent).run(
      { mode: "LIVE_ENQUEUE" },
      undefined,
    );
    assert.equal(res.failed, 1);
    assert.equal(store.claimed.length, 0);
  });

  it("sends the notice and completes the outbox", async () => {
    const store = new FakeStore();
    const id = randomUUID();
    const payload = notice();
    store.stored.set(id, {
      id,
      eventType: "PAYMENT_EXPIRED_REFUND_NOTICE",
      payload,
      status: OutboxStatus.PROCESSING,
    });
    const sent: string[] = [];
    const sender: EmailSender = {
      sendRegistration: async () => "x",
      sendReview: async () => "x",
      sendRefundNotice: async (outboxId) => {
        sent.push(outboxId);
        return "notice-1";
      },
    };
    const res = await new ProcessEmailJobUseCase(
      store,
      sender,
      { mode: "live", realEmailEnabled: true },
      silent,
    ).execute({
      name: "refund-notice",
      data: {
        outboxId: id,
        eventType: "PAYMENT_EXPIRED_REFUND_NOTICE",
        payload,
      },
    });
    assert.deepEqual(res, {
      simulated: false,
      provider: "resend",
      emailId: "notice-1",
    });
    assert.deepEqual(sent, [id]);
    assert.deepEqual(store.completed, [id]);
  });

  it("rejects a notice job with the wrong job name", async () => {
    const store = new FakeStore();
    const id = randomUUID();
    const payload = notice();
    store.stored.set(id, {
      id,
      eventType: "PAYMENT_EXPIRED_REFUND_NOTICE",
      payload,
      status: OutboxStatus.PROCESSING,
    });
    await assert.rejects(
      new ProcessEmailJobUseCase(
        store,
        {} as EmailSender,
        { mode: "live", realEmailEnabled: true },
        silent,
      ).execute({
        name: "admin-review",
        data: {
          outboxId: id,
          eventType: "PAYMENT_EXPIRED_REFUND_NOTICE",
          payload,
        },
      }),
    );
  });
});

describe("ProcessEmailJobUseCase", () => {
  const config = (
    over: Partial<EmailWorkerConfig> = {},
  ): EmailWorkerConfig => ({
    mode: "live",
    realEmailEnabled: true,
    ...over,
  });

  function setup(
    opts: {
      status?: string;
      payload?: ReturnType<typeof registration>;
      config?: EmailWorkerConfig;
    } = {},
  ) {
    const store = new FakeStore();
    const payload = opts.payload ?? registration();
    const id = randomUUID();
    store.stored.set(id, {
      id,
      eventType: "USER_REGISTERED",
      payload,
      status: opts.status ?? OutboxStatus.PROCESSING,
    });
    const sent: string[] = [];
    const sender: EmailSender = {
      sendRegistration: async (outboxId) => {
        sent.push(outboxId);
        return "email-1";
      },
      sendReview: async () => "email-2",
      sendRefundNotice: async (outboxId) => {
        sent.push(outboxId);
        return "email-3";
      },
    };
    const useCase = new ProcessEmailJobUseCase(
      store,
      sender,
      opts.config ?? config(),
      silent,
    );
    const job = (data?: Partial<{ payload: unknown }>) => ({
      name: "user-registered",
      data: {
        outboxId: id,
        eventType: "USER_REGISTERED" as const,
        payload,
        ...data,
      } as never,
    });
    return { store, sent, useCase, job, id, payload };
  }

  it("sends the email and completes the outbox in live mode", async () => {
    const { store, sent, useCase, job, id } = setup();
    const res = await useCase.execute(job());
    assert.deepEqual(res, {
      simulated: false,
      provider: "resend",
      emailId: "email-1",
    });
    assert.deepEqual(sent, [id]);
    assert.deepEqual(store.completed, [id]);
  });

  it("does nothing but simulate in mock mode and keeps the outbox PROCESSING", async () => {
    const { store, sent, useCase, job } = setup({
      config: config({ mode: "mock" }),
    });
    assert.deepEqual(await useCase.execute(job()), { simulated: true });
    assert.equal(sent.length, 0);
    assert.equal(store.completed.length, 0);
  });

  it("refuses payloads that differ from PostgreSQL", async () => {
    const { useCase, job } = setup();
    await assert.rejects(
      () => useCase.execute(job({ payload: registration("evil@x.vn") })),
      /does not match/,
    );
  });

  it("is idempotent for completed events and rejects unexpected statuses", async () => {
    const done = setup({ status: OutboxStatus.COMPLETED });
    assert.deepEqual(await done.useCase.execute(done.job()), {
      alreadyCompleted: true,
    });
    assert.equal(done.sent.length, 0);

    const pending = setup({ status: OutboxStatus.PENDING });
    await assert.rejects(
      () => pending.useCase.execute(pending.job()),
      /Unexpected Outbox status/,
    );
  });

  it("enforces recipient and enablement rules per mode", async () => {
    const liveTest = setup({
      payload: registration("a@b.vn"),
      config: config({ mode: "live-test", testEmailTo: "other@b.vn" }),
    });
    await assert.rejects(
      () => liveTest.useCase.execute(liveTest.job()),
      /not TEST_EMAIL_TO/,
    );

    const disabled = setup({ config: config({ realEmailEnabled: false }) });
    await assert.rejects(
      () => disabled.useCase.execute(disabled.job()),
      /disabled/,
    );

    const unknown = setup({ config: config({ mode: "weird" }) });
    await assert.rejects(
      () => unknown.useCase.execute(unknown.job()),
      /Unsupported mode/,
    );
  });

  it("fails when the email was accepted but the outbox cannot be completed", async () => {
    const { store, useCase, job } = setup();
    store.completeResult = false;
    await assert.rejects(() => useCase.execute(job()), /completion failed/);
  });

  it("rejects jobs with the wrong name or unknown outbox", async () => {
    const { useCase, job } = setup();
    await assert.rejects(
      () => useCase.execute({ ...job(), name: "other" }),
      /Invalid registration job/,
    );
    const missing = setup();
    missing.store.stored.clear();
    await assert.rejects(
      () => missing.useCase.execute(missing.job()),
      /not found/,
    );
  });
});

describe("outbox recovery", () => {
  const stale = (id = randomUUID()): StaleOutboxEvent => ({
    id,
    eventType: "USER_REGISTERED",
    status: OutboxStatus.PROCESSING,
    retryCount: 0,
    updatedAt: new Date(Date.now() - 3_600_000),
  });
  const job = (id: string, state: string, attempts = 3): QueuedEmailJob => ({
    data: {
      outboxId: id,
      eventType: "USER_REGISTERED",
      payload: registration(),
    },
    state,
    attemptsMade: attempts,
    maxAttempts: 3,
  });

  it("waits for jobs still managed by BullMQ and reviews unknown states", async () => {
    const store = new FakeStore();
    const queue = new FakeQueue();
    const waiting = stale();
    const missing = stale();
    store.stale = [waiting, missing];
    queue.jobs.set(`outbox_${waiting.id}`, job(waiting.id, "active", 1));
    const res = await new RecoverOutboxUseCase(store, queue, silent).run({
      markFailed: false,
    });
    assert.deepEqual(res, { inspected: 2, markedFailed: 0, requiresReview: 1 });
  });

  it("never marks failed in read-only mode, even when retries are exhausted", async () => {
    const store = new FakeStore();
    const queue = new FakeQueue();
    const e = stale();
    store.stale = [e];
    queue.jobs.set(`outbox_${e.id}`, job(e.id, "failed"));
    const res = await new RecoverOutboxUseCase(store, queue, silent).run({
      markFailed: false,
    });
    assert.equal(res.markedFailed, 0);
    assert.equal(store.failedMarked.length, 0);
  });

  it("marks exhausted outboxes FAILED only in write mode and reports concurrent changes", async () => {
    const store = new FakeStore();
    const queue = new FakeQueue();
    const e = stale();
    store.stale = [e];
    queue.jobs.set(`outbox_${e.id}`, job(e.id, "failed"));

    const ok = await new RecoverOutboxUseCase(store, queue, silent).run({
      markFailed: true,
      targetId: e.id,
    });
    assert.equal(ok.markedFailed, 1);
    assert.deepEqual(store.failedMarked, [e.id]);

    store.markFailedResult = false;
    const raced = await new RecoverOutboxUseCase(store, queue, silent).run({
      markFailed: true,
      targetId: e.id,
    });
    assert.deepEqual(raced, {
      inspected: 1,
      markedFailed: 0,
      requiresReview: 1,
    });
  });

  it("flags a queue job that belongs to a different outbox", async () => {
    const store = new FakeStore();
    const queue = new FakeQueue();
    const e = stale();
    store.stale = [e];
    queue.jobs.set(`outbox_${e.id}`, job(randomUUID(), "failed"));
    const res = await new RecoverOutboxUseCase(store, queue, silent).run({
      markFailed: true,
      targetId: e.id,
    });
    assert.equal(res.requiresReview, 1);
    assert.equal(store.failedMarked.length, 0);
  });

  it("guards the write mode behind explicit approval for one outbox", () => {
    const id = randomUUID();
    assert.doesNotThrow(() =>
      assertRecoveryWriteAllowed(parseRecoveryArgs([]), {}),
    );
    const req = parseRecoveryArgs(["--mark-failed", `--outbox-id=${id}`]);
    assert.throws(() => assertRecoveryWriteAllowed(req, {}));
    assert.throws(() =>
      assertRecoveryWriteAllowed(req, { ENABLE_OUTBOX_RECOVERY_WRITE: "true" }),
    );
    assert.doesNotThrow(() =>
      assertRecoveryWriteAllowed(req, {
        ENABLE_OUTBOX_RECOVERY_WRITE: "true",
        OUTBOX_RECOVERY_APPROVED_ID: id,
      }),
    );
    assert.throws(() =>
      assertRecoveryWriteAllowed(parseRecoveryArgs(["--mark-failed"]), {
        ENABLE_OUTBOX_RECOVERY_WRITE: "true",
      }),
    );
    assert.throws(() => parseRecoveryArgs(["--outbox-id=not-a-uuid"]));
  });
});
