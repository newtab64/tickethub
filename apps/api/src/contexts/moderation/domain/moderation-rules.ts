import { EventStatus, OrganizerStatus } from "@tickethub/shared";
import { moderationErrors } from "./moderation.errors";
import type {
  EventForReview,
  EventForSuspension,
  EventOutcome,
  OrganizerForReview,
  OrganizerOutcome,
  ReviewDto,
} from "./moderation.models";

/** Ho so phai ton tai va dang cho xac minh moi duyet duoc. */
export function assertOrganizerReviewable(
  profile: OrganizerForReview | null,
): OrganizerForReview {
  if (!profile) throw moderationErrors.organizerNotFound();
  if (profile.status !== OrganizerStatus.PENDING_VERIFICATION) {
    throw moderationErrors.organizerAlreadyProcessed();
  }
  return profile;
}

/** Ket qua cua quyet dinh duyet ho so Ban to chuc (KYC). */
export function decideOrganizer(dto: ReviewDto): OrganizerOutcome {
  const approve = dto.decision === "APPROVE";
  return {
    newStatus: approve ? OrganizerStatus.VERIFIED : OrganizerStatus.REJECTED,
    rejectionReason: approve ? null : (dto.reason ?? null),
    verifiedByAdmin: approve,
    action: approve ? "ORGANIZER_APPROVED" : "ORGANIZER_REJECTED",
  };
}

/** Su kien phai ton tai va dang PENDING_APPROVAL moi duyet duoc. */
export function assertEventReviewable(
  event: EventForReview | null,
): EventForReview {
  if (!event) throw moderationErrors.reviewEventNotFound();
  if (event.status !== EventStatus.PENDING_APPROVAL) {
    throw moderationErrors.eventNotInReview();
  }
  return event;
}

/** Duyet: PUBLISHED. Tu choi: quay ve DRAFT kem ly do. */
export function decideEvent(dto: ReviewDto): EventOutcome {
  const approve = dto.decision === "APPROVE";
  return {
    newStatus: approve ? EventStatus.PUBLISHED : EventStatus.DRAFT,
    rejectionReason: approve ? null : (dto.reason ?? null),
    action: approve ? "EVENT_APPROVED" : "EVENT_REJECTED",
  };
}

/** Version khoa lac quan: dung version gui len, neu khong thi version hien tai. */
export function expectedVersionOf(
  dtoVersion: number | undefined,
  currentVersion: number,
): number {
  return dtoVersion ?? currentVersion;
}

/** Chi su kien PUBLISHED moi ngat khan cap duoc; version gui len phai khop. */
export function assertCanSuspend(
  event: EventForSuspension | null,
  dtoVersion: number | undefined,
): EventForSuspension {
  if (!event) throw moderationErrors.eventNotFound();
  if (event.status === EventStatus.SUSPENDED) {
    throw moderationErrors.eventAlreadySuspended();
  }
  if (event.status !== EventStatus.PUBLISHED) {
    throw moderationErrors.eventNotPublished();
  }
  if (dtoVersion !== undefined && dtoVersion !== event.version) {
    throw moderationErrors.versionMismatch();
  }
  return event;
}

/** Chi su kien SUSPENDED, chua ket thuc moi khoi phuc duoc; version phai khop. */
export function assertCanResume(
  event: EventForSuspension | null,
  dtoVersion: number | undefined,
  now: Date,
): EventForSuspension {
  if (!event) throw moderationErrors.eventNotFound();
  if (event.status !== EventStatus.SUSPENDED) {
    throw moderationErrors.eventNotSuspended();
  }
  if (event.endTime && new Date(event.endTime) <= now) {
    throw moderationErrors.eventAlreadyEnded();
  }
  if (dtoVersion !== undefined && dtoVersion !== event.version) {
    throw moderationErrors.versionMismatch();
  }
  return event;
}

export function totalReleasedHolds(c: {
  releasedHeldSeatsCount: number;
  releasedHeldStandingCount: number;
}): number {
  return c.releasedHeldSeatsCount + c.releasedHeldStandingCount;
}
