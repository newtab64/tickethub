export type DispatchMode =
  "DRY_RUN" | "TEST_ENQUEUE" | "LIVE_ENQUEUE" | "EMAIL_TEST" | "REVIEW_TEST";

export const DISPATCH_MODE_LABEL: Record<DispatchMode, string> = {
  DRY_RUN: "DRY RUN",
  TEST_ENQUEUE: "TEST ENQUEUE",
  LIVE_ENQUEUE: "LIVE ENQUEUE",
  EMAIL_TEST: "EMAIL LIVE TEST",
  REVIEW_TEST: "REVIEW EMAIL TEST",
};

export interface DispatchOptions {
  mode: DispatchMode;
  targetOutboxId?: string | undefined;
}

const UUID_PATTERN = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** Doc tham so dong lenh; chi cho phep mot che do enqueue va toi da mot --outbox-id. */
export function parseDispatchArgs(argv: string[]): DispatchOptions {
  const flags = {
    TEST_ENQUEUE: argv.includes("--enqueue-test"),
    LIVE_ENQUEUE: argv.includes("--enqueue"),
    EMAIL_TEST: argv.includes("--enqueue-email-test"),
    REVIEW_TEST: argv.includes("--enqueue-review-test"),
  };
  const active = (Object.keys(flags) as Array<keyof typeof flags>).filter(
    (k) => flags[k],
  );
  if (active.length > 1) throw new Error("Only one enqueue mode is allowed");

  const idArgs = argv.filter((a) => a.startsWith("--outbox-id="));
  if (idArgs.length > 1) throw new Error("Only one outbox ID is allowed");

  return {
    mode: active[0] ?? "DRY_RUN",
    targetOutboxId: idArgs[0]?.slice("--outbox-id=".length),
  };
}

export interface DispatchEnvironment {
  databaseName: string;
  redisDatabasePath: string;
  redisHostname: string | null;
  flags: Record<string, string | undefined>;
}

/** Cac rao chan an toan cho tung che do; nem loi khi cau hinh khong du an toan. */
export function assertDispatchAllowed(
  options: DispatchOptions,
  env: DispatchEnvironment,
): void {
  const f = env.flags;
  const testEmail = f.TEST_EMAIL_TO?.trim().toLowerCase();

  if (options.mode === "REVIEW_TEST") {
    if (f.ENABLE_REVIEW_EMAIL_TEST !== "true") {
      throw new Error("Review email test is disabled");
    }
    if (!env.databaseName.endsWith("_test")) {
      throw new Error("Review test requires a dedicated _test database");
    }
    if (env.redisDatabasePath !== "/15") {
      throw new Error("Review test requires Redis database 15");
    }
    if (f.EMAIL_WORKER_MODE !== "live-test") {
      throw new Error("Review test requires live-test worker mode");
    }
    if (!testEmail) throw new Error("TEST_EMAIL_TO is required");
    if (!options.targetOutboxId || !UUID_PATTERN.test(options.targetOutboxId)) {
      throw new Error("Review test requires --outbox-id=<UUID>");
    }
  }

  if (options.mode === "EMAIL_TEST") {
    if (f.ENABLE_TEST_EMAIL_DISPATCH !== "true") {
      throw new Error("Test email dispatch is disabled");
    }
    if (!testEmail) throw new Error("TEST_EMAIL_TO is required");
    if (f.EMAIL_WORKER_MODE !== "live-test") {
      throw new Error("Worker must use live-test mode");
    }
    if (env.redisHostname !== "email-test-redis") {
      throw new Error("Test dispatch must use isolated Redis");
    }
  }

  if (
    options.mode === "LIVE_ENQUEUE" &&
    f.ENABLE_REAL_EMAIL_DISPATCH !== "true"
  ) {
    throw new Error("Real email dispatch is disabled");
  }
}

/** Trong che do kiem thu, chi gui cho dung nguoi nhan / du lieu thu nghiem. */
export function isAllowedForMode(
  options: DispatchOptions,
  recipient: {
    registrationEmail?: string;
    reviewEmail?: string;
    token?: string;
  },
  testEmail: string | undefined,
): boolean {
  switch (options.mode) {
    case "REVIEW_TEST":
      return (
        recipient.reviewEmail !== undefined &&
        recipient.reviewEmail.toLowerCase() === testEmail
      );
    case "EMAIL_TEST":
      return (
        recipient.registrationEmail !== undefined &&
        recipient.registrationEmail.toLowerCase() === testEmail
      );
    case "TEST_ENQUEUE":
      return (
        recipient.registrationEmail === "outbox-smoke@example.invalid" &&
        recipient.token === "fake-test-token"
      );
    default:
      return true;
  }
}

export function isValidOutboxId(id: string): boolean {
  return UUID_PATTERN.test(id);
}
