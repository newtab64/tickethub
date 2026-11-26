import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import {
  EventStatus,
  OrganizerStatus,
  UserRole,
  UserStatus,
} from "@tickethub/shared";
import { createModerationServices } from "../src/contexts/moderation/moderation.composition";
import { ModerationDomainError } from "../src/contexts/moderation/domain/moderation.errors";
import { db, sqlClient } from "../src/database/db";
import {
  auditLog,
  events,
  organizerProfiles,
  users,
} from "../src/database/schema";

async function codeOf(work: Promise<unknown>) {
  try {
    await work;
  } catch (e) {
    return e instanceof ModerationDomainError ? e.code : "OTHER";
  }
  return "NONE";
}

describe("Moderation: KYC and event approval against the real database", () => {
  const { kyc, events: eventModeration } = createModerationServices();
  const stamp = Date.now();
  const userIds: string[] = [];
  const profileIds: string[] = [];
  const eventIds: string[] = [];
  let adminId = "";

  async function pendingOrganizer(label: string) {
    const [u] = await db
      .insert(users)
      .values({
        email: `mod_${label}_${stamp}@tickethub.vn`,
        fullName: `Mod ${label}`,
        passwordHash: "$argon2id$dummy",
        role: UserRole.ORGANIZER,
        status: UserStatus.ACTIVE,
      })
      .returning();
    userIds.push(u!.id);
    const [p] = await db
      .insert(organizerProfiles)
      .values({
        userId: u!.id,
        organizationName: `Org ${label}`,
        taxCode: `TAX${stamp}${label}`.slice(0, 40),
        businessLicenseUrl: "https://example.com/license.pdf",
        representativeName: "Dai Dien",
      })
      .returning();
    profileIds.push(p!.id);
    return p!;
  }

  async function pendingEvent(organizerId: string) {
    const start = new Date(Date.now() + 10 * 24 * 3600 * 1000);
    const [e] = await db
      .insert(events)
      .values({
        organizerId,
        title: "Moderation Event",
        slug: `mod-${randomUUID().slice(0, 8)}`,
        description: "d",
        category: "Am nhac",
        bannerUrl: "https://cdn.tickethub.vn/b.webp",
        venueName: "v",
        venueAddress: "a",
        city: "Ha Noi",
        startTime: start,
        endTime: new Date(start.getTime() + 3600_000),
        gateOpeningTime: start,
        status: EventStatus.PENDING_APPROVAL,
      })
      .returning();
    eventIds.push(e!.id);
    return e!;
  }

  before(async () => {
    const [adm] = await db
      .insert(users)
      .values({
        email: `mod_admin_${stamp}@tickethub.vn`,
        fullName: "Mod Admin",
        passwordHash: "$argon2id$dummy",
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      })
      .returning();
    adminId = adm!.id;
    userIds.push(adminId);
  });

  after(async () => {
    const targets = [...profileIds, ...eventIds];
    if (targets.length) {
      await db.delete(auditLog).where(inArray(auditLog.targetId, targets));
      await sqlClient`DELETE FROM outbox WHERE payload->>'profileId' = ANY(${profileIds}) OR payload->>'eventId' = ANY(${eventIds})`;
    }
    if (eventIds.length) {
      await db.delete(events).where(inArray(events.id, eventIds));
    }
    if (profileIds.length) {
      await db
        .update(organizerProfiles)
        .set({ verifiedBy: null })
        .where(inArray(organizerProfiles.id, profileIds));
      await db
        .delete(organizerProfiles)
        .where(inArray(organizerProfiles.id, profileIds));
    }
    await db.delete(users).where(inArray(users.id, userIds));
    await sqlClient.end();
  });

  it("approves a KYC profile once, with audit log and outbox", async () => {
    const profile = await pendingOrganizer("a");

    const pending = await kyc.getPendingOrganizers();
    assert.ok(pending.some((p) => p.id === profile.id));

    const approved = await kyc.reviewOrganizer(
      profile.id,
      adminId,
      { decision: "APPROVE" },
      { ipAddress: "9.9.9.9", userAgent: "ua" },
    );
    assert.equal(approved.status, OrganizerStatus.VERIFIED);
    assert.equal(approved.verifiedBy, adminId);
    assert.equal(approved.version, 2);

    const [log] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.targetId, profile.id));
    assert.equal(log?.action, "ORGANIZER_APPROVED");
    assert.equal(log?.ipAddress, "9.9.9.9");

    const rows =
      await sqlClient`SELECT event_type FROM outbox WHERE payload->>'profileId' = ${profile.id}`;
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.event_type, "ORGANIZER_APPROVED");

    assert.equal(
      await codeOf(
        kyc.reviewOrganizer(profile.id, adminId, { decision: "APPROVE" }),
      ),
      "ORGANIZER_ALREADY_PROCESSED",
    );
  });

  it("rejects a KYC profile with a reason and handles unknown profiles", async () => {
    const profile = await pendingOrganizer("b");
    const rejected = await kyc.reviewOrganizer(profile.id, adminId, {
      decision: "REJECT",
      reason: "Giay phep khong hop le",
    });
    assert.equal(rejected.status, OrganizerStatus.REJECTED);
    assert.equal(rejected.rejectionReason, "Giay phep khong hop le");
    assert.equal(rejected.verifiedBy, null);

    assert.equal(
      await codeOf(
        kyc.reviewOrganizer(randomUUID(), adminId, { decision: "APPROVE" }),
      ),
      "ORGANIZER_NOT_FOUND",
    );
  });

  it("detects a stale version when approving a profile", async () => {
    const profile = await pendingOrganizer("c");
    assert.equal(
      await codeOf(
        kyc.reviewOrganizer(profile.id, adminId, {
          decision: "APPROVE",
          version: 99,
        }),
      ),
      "CONCURRENT_MODIFICATION",
    );
  });

  it("publishes an approved event and sends a rejected one back to DRAFT", async () => {
    const profile = await pendingOrganizer("d");
    const e1 = await pendingEvent(profile.id);
    const e2 = await pendingEvent(profile.id);

    const published = await eventModeration.reviewEvent(e1.id, adminId, {
      decision: "APPROVE",
    });
    assert.equal(published.status, EventStatus.PUBLISHED);

    const drafted = await eventModeration.reviewEvent(e2.id, adminId, {
      decision: "REJECT",
      reason: "Thieu giay phep bieu dien",
    });
    assert.equal(drafted.status, EventStatus.DRAFT);
    assert.equal(drafted.rejectionReason, "Thieu giay phep bieu dien");

    const pending = await eventModeration.getPendingEvents();
    assert.ok(!pending.some((p) => p.id === e1.id || p.id === e2.id));

    assert.equal(
      await codeOf(
        eventModeration.reviewEvent(e1.id, adminId, { decision: "APPROVE" }),
      ),
      "EVENT_NOT_IN_REVIEW",
    );
    assert.equal(
      await codeOf(
        eventModeration.reviewEvent(randomUUID(), adminId, {
          decision: "APPROVE",
        }),
      ),
      "EVENT_NOT_FOUND",
    );
  });

  it("lets only one of two concurrent approvals of the same event win", async () => {
    const profile = await pendingOrganizer("e");
    const event = await pendingEvent(profile.id);

    const results = await Promise.allSettled([
      eventModeration.reviewEvent(event.id, adminId, { decision: "APPROVE" }),
      eventModeration.reviewEvent(event.id, adminId, { decision: "APPROVE" }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const logs = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.targetId, event.id));
    assert.equal(logs.length, 1);
  });
});
