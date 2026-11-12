export interface AuditLogEntry {
  id: string;
  action:
    "APPROVE_ORGANIZER" | "REJECT_ORGANIZER" | "APPROVE_EVENT" | "REJECT_EVENT";
  targetName: string;
  actorEmail: string;
  reason?: string;
  timestamp: string;
}
