import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EventStatus, OrganizerStatus } from "@tickethub/shared";
import {
  assertCanResume,
  assertCanSuspend,
  assertEventReviewable,
  assertOrganizerReviewable,
  decideEvent,
  decideOrganizer,
  expectedVersionOf,
  totalReleasedHolds,
} from "../src/contexts/moderation/domain/moderation-rules";
import { ModerationDomainError } from "../src/contexts/moderation/domain/moderation.errors";

const NOW = new Date("2026-11-11T10:00:00.000Z");

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof ModerationDomainError);
    return err.code;
  }
  return "NONE";
}

const published = (overrides = {}) => ({
  id: "e",
  status: EventStatus.PUBLISHED as string,
  version: 3,
  endTime: new Date(NOW.getTime() + 86_400_000),
  ...overrides,
});

describe("KYC and event review decisions", () => {
  it("maps decisions to organizer statuses", () => {
    const ok = decideOrganizer({ decision: "APPROVE" });
    assert.equal(ok.newStatus, OrganizerStatus.VERIFIED);
    assert.equal(ok.verifiedByAdmin, true);
    assert.equal(ok.rejectionReason, null);

    const no = decideOrganizer({ decision: "REJECT", reason: "x" });
    assert.equal(no.newStatus, OrganizerStatus.REJECTED);
    assert.equal(no.rejectionReason, "x");
    assert.equal(no.action, "ORGANIZER_REJECTED");
  });

  it("publishes approved events and returns rejected ones to DRAFT", () => {
    assert.equal(
      decideEvent({ decision: "APPROVE" }).newStatus,
      EventStatus.PUBLISHED,
    );
    const rejected = decideEvent({ decision: "REJECT", reason: "r" });
    assert.equal(rejected.newStatus, EventStatus.DRAFT);
    assert.equal(rejected.rejectionReason, "r");
  });

  it("requires pending items to be reviewable", () => {
    const org = (status: string) => ({
      id: "p",
      userId: "u",
      organizationName: "O",
      status,
      version: 1,
    });
    assert.equal(
      codeOf(() => assertOrganizerReviewable(null)),
      "ORGANIZER_NOT_FOUND",
    );
    assert.equal(
      codeOf(() => assertOrganizerReviewable(org(OrganizerStatus.VERIFIED))),
      "ORGANIZER_ALREADY_PROCESSED",
    );
    assert.equal(
      codeOf(() =>
        assertOrganizerReviewable(org(OrganizerStatus.PENDING_VERIFICATION)),
      ),
      "NONE",
    );

    const evt = (status: string) => ({
      id: "e",
      title: "T",
      organizerId: "o",
      status,
      version: 1,
    });
    assert.equal(
      codeOf(() => assertEventReviewable(null)),
      "EVENT_NOT_FOUND",
    );
    assert.equal(
      codeOf(() => assertEventReviewable(evt(EventStatus.DRAFT))),
      "EVENT_NOT_IN_REVIEW",
    );
    assert.equal(
      codeOf(() => assertEventReviewable(evt(EventStatus.PENDING_APPROVAL))),
      "NONE",
    );
  });

  it("uses the supplied version or falls back to the current one", () => {
    assert.equal(expectedVersionOf(5, 2), 5);
    assert.equal(expectedVersionOf(undefined, 2), 2);
  });
});

describe("Kill Switch rules", () => {
  it("only PUBLISHED events can be suspended, with a matching version", () => {
    assert.equal(
      codeOf(() => assertCanSuspend(null, undefined)),
      "EVENT_NOT_FOUND",
    );
    assert.equal(
      codeOf(() =>
        assertCanSuspend(
          published({ status: EventStatus.SUSPENDED }),
          undefined,
        ),
      ),
      "EVENT_ALREADY_SUSPENDED",
    );
    assert.equal(
      codeOf(() =>
        assertCanSuspend(published({ status: EventStatus.DRAFT }), undefined),
      ),
      "EVENT_NOT_PUBLISHED",
    );
    assert.equal(
      codeOf(() => assertCanSuspend(published(), 2)),
      "CONCURRENT_MODIFICATION",
    );
    assert.equal(
      codeOf(() => assertCanSuspend(published(), 3)),
      "NONE",
    );
    assert.equal(
      codeOf(() => assertCanSuspend(published(), undefined)),
      "NONE",
    );
  });

  it("only SUSPENDED, unfinished events can be resumed", () => {
    const suspended = (overrides = {}) =>
      published({ status: EventStatus.SUSPENDED, ...overrides });
    assert.equal(
      codeOf(() => assertCanResume(null, undefined, NOW)),
      "EVENT_NOT_FOUND",
    );
    assert.equal(
      codeOf(() => assertCanResume(published(), undefined, NOW)),
      "EVENT_NOT_SUSPENDED",
    );
    assert.equal(
      codeOf(() =>
        assertCanResume(
          suspended({ endTime: new Date(NOW.getTime() - 1) }),
          undefined,
          NOW,
        ),
      ),
      "EVENT_ALREADY_ENDED",
    );
    assert.equal(
      codeOf(() => assertCanResume(suspended(), 1, NOW)),
      "CONCURRENT_MODIFICATION",
    );
    assert.equal(
      codeOf(() => assertCanResume(suspended(), 3, NOW)),
      "NONE",
    );
  });

  it("adds seat and standing holds into one total", () => {
    assert.equal(
      totalReleasedHolds({
        releasedHeldSeatsCount: 4,
        releasedHeldStandingCount: 3,
      }),
      7,
    );
  });
});
