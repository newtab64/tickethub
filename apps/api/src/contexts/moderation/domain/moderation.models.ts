import type {
  AuditLogListData,
  AuditLogQuery,
  EventKillSwitchData,
  EventKillSwitchRequest,
  EventResumeData,
  EventResumeRequest,
} from "@tickethub/shared";

export type {
  AuditLogListData,
  AuditLogQuery,
  EventKillSwitchData,
  EventKillSwitchRequest,
  EventResumeData,
  EventResumeRequest,
};

export type ReviewDecision = "APPROVE" | "REJECT";

export interface ReviewDto {
  decision: ReviewDecision;
  reason?: string | undefined;
  version?: number | undefined;
}

export interface AuditRequestMeta {
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
}

/** Ho so Ban to chuc cho viec kiem duyet KYC. */
export interface OrganizerForReview {
  id: string;
  userId: string;
  organizationName: string;
  status: string;
  version: number;
}

/** Su kien cho viec phe duyet mo ban. */
export interface EventForReview {
  id: string;
  title: string;
  organizerId: string;
  status: string;
  version: number;
}

export interface EventForSuspension {
  id: string;
  status: string;
  version: number;
  endTime?: Date | null;
}

/** Ban ghi sau khi cap nhat (hinh dang day du nhu API cong bo). */
export type UpdatedOrganizer = {
  id: string;
  userId: string;
  organizationName: string;
} & Record<string, unknown>;

export type UpdatedEvent = {
  id: string;
  title: string;
  organizerId: string;
  status: string;
  version: number;
  rejectionReason?: string | null;
} & Record<string, unknown>;

export interface OwnerContact {
  userId: string;
  email: string | null;
}

export interface OrganizerOutcome {
  newStatus: string;
  rejectionReason: string | null;
  verifiedByAdmin: boolean;
  action: "ORGANIZER_APPROVED" | "ORGANIZER_REJECTED";
}

export interface EventOutcome {
  newStatus: string;
  rejectionReason: string | null;
  action: "EVENT_APPROVED" | "EVENT_REJECTED";
}

export interface SuspensionCascade {
  cancelledPendingOrdersCount: number;
  releasedHeldSeatsCount: number;
  releasedHeldStandingCount: number;
}

export interface AuditEntry {
  actorId: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  changes: Record<string, unknown>;
  meta: AuditRequestMeta | undefined;
}
