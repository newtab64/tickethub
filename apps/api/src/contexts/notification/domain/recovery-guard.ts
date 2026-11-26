import { isValidOutboxId } from "./dispatch-mode";

export interface RecoveryRequest {
  markFailed: boolean;
  targetId?: string | undefined;
}

/** Doc tham so dong lenh cua tien trinh phuc hoi outbox. */
export function parseRecoveryArgs(argv: string[]): RecoveryRequest {
  const idArgs = argv.filter((a) => a.startsWith("--outbox-id="));
  if (idArgs.length > 1) throw new Error("Only one --outbox-id is allowed.");

  const targetId = idArgs[0]?.slice("--outbox-id=".length);
  if (targetId && !isValidOutboxId(targetId)) {
    throw new Error("Invalid Outbox UUID.");
  }
  return { markFailed: argv.includes("--mark-failed"), targetId };
}

/** Che do ghi can bat co, chi ro --outbox-id va xac nhan ro rang cho dung ban ghi do. */
export function assertRecoveryWriteAllowed(
  request: RecoveryRequest,
  env: Record<string, string | undefined>,
): void {
  if (!request.markFailed) return;
  if (env.ENABLE_OUTBOX_RECOVERY_WRITE !== "true") {
    throw new Error(
      "Recovery write is disabled. ENABLE_OUTBOX_RECOVERY_WRITE must be true.",
    );
  }
  if (!request.targetId) {
    throw new Error("--mark-failed requires --outbox-id=<UUID>");
  }
  if (env.OUTBOX_RECOVERY_APPROVED_ID !== request.targetId) {
    throw new Error("Explicit approval for this Outbox is required.");
  }
}
