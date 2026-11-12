import { moderationErrors } from "../domain/moderation.errors";
import type {
  AuditLogListData,
  AuditLogQuery,
} from "../domain/moderation.models";
import type { ModerationQueryPort } from "../domain/moderation.ports";

/** Truy van nhat ky kiem toan bat bien (chi doc, append-only) theo su kien. */
export class AuditLogQueries {
  constructor(private readonly query: ModerationQueryPort) {}

  async getEventAuditLogs(
    eventId: string,
    query: AuditLogQuery,
  ): Promise<AuditLogListData> {
    if (!(await this.query.eventExists(eventId))) {
      throw moderationErrors.eventNotFound();
    }
    return this.query.listEventAuditLogs(eventId, query);
  }
}
