// Du lieu tam: nhat ky kiem duyet khi backend khong kha dung.
import type { AuditLogEntry } from "../domain/moderation.types";

export const MOCK_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: "log-01",
    action: "APPROVE_ORGANIZER",
    targetName: "Hanoi Symphony Orchestra Club",
    actorEmail: "admin@tickethub.com",
    timestamp: "2026-10-20T14:00:00Z",
  },
];
