import { AuditLogQueries } from "./application/audit-log-queries.service";
import { EventModerationService } from "./application/event-moderation.service";
import { KycModerationService } from "./application/kyc-moderation.service";
import type {
  EventCacheInvalidator,
  ModerationQueryPort,
  ModerationUnitOfWork,
} from "./domain/moderation.ports";
import {
  DrizzleModerationQuery,
  DrizzleModerationUnitOfWork,
} from "./infrastructure/drizzle-moderation.repository";

/** Lap rap dich vu kiem duyet; `cache` thuoc context Event va la tuy chon. */
export function createModerationServices(
  cache?: EventCacheInvalidator,
  overrides: {
    query?: ModerationQueryPort;
    unitOfWork?: ModerationUnitOfWork;
  } = {},
) {
  const query = overrides.query ?? new DrizzleModerationQuery();
  const unitOfWork = overrides.unitOfWork ?? new DrizzleModerationUnitOfWork();
  return {
    kyc: new KycModerationService(query, unitOfWork),
    events: new EventModerationService(query, unitOfWork, cache),
    auditLogs: new AuditLogQueries(query),
  };
}
