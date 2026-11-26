import { OrganizerStatus, UserRole } from "@tickethub/shared";
import {
  assertOrganizerReviewable,
  decideOrganizer,
  expectedVersionOf,
} from "../domain/moderation-rules";
import { moderationErrors } from "../domain/moderation.errors";
import type { AuditRequestMeta, ReviewDto } from "../domain/moderation.models";
import type {
  ModerationQueryPort,
  ModerationUnitOfWork,
} from "../domain/moderation.ports";

/** Lop 1: xac minh danh tinh Ban to chuc (KYC) truoc khi cap quyen tao su kien. */
export class KycModerationService {
  constructor(
    private readonly query: ModerationQueryPort,
    private readonly unitOfWork: ModerationUnitOfWork,
  ) {}

  getPendingOrganizers() {
    return this.query.listPendingOrganizers();
  }

  reviewOrganizer(
    profileId: string,
    adminId: string,
    dto: ReviewDto,
    meta?: AuditRequestMeta,
  ) {
    const outcome = decideOrganizer(dto);

    return this.unitOfWork.run(async (tx) => {
      const existing = assertOrganizerReviewable(
        await tx.findOrganizer(profileId),
      );

      const updated = await tx.updateOrganizerIfPending({
        profileId,
        expectedVersion: expectedVersionOf(dto.version, existing.version),
        newStatus: outcome.newStatus,
        rejectionReason: outcome.rejectionReason,
        verifiedBy: outcome.verifiedByAdmin ? adminId : null,
        verifiedAt: outcome.verifiedByAdmin ? new Date() : null,
      });
      if (!updated) throw moderationErrors.organizerConcurrent();

      const owner = await tx.findUserContact(updated.userId);
      if (!owner || !owner.email) throw moderationErrors.ownerAccountNotFound();

      await tx.writeAudit({
        actorId: adminId,
        actorRole: UserRole.ADMIN,
        action: outcome.action,
        targetType: "ORGANIZER_PROFILE",
        targetId: updated.id,
        changes: {
          oldStatus: OrganizerStatus.PENDING_VERIFICATION,
          newStatus: outcome.newStatus,
          reason: dto.reason ?? null,
        },
        meta,
      });

      await tx.enqueueOutbox(outcome.action, {
        profileId: updated.id,
        userId: updated.userId,
        email: owner.email,
        organizationName: updated.organizationName,
        decision: dto.decision,
        reason: dto.reason ?? null,
      });

      return updated;
    });
  }
}
