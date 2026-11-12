import { and, eq } from "drizzle-orm";
import { OrganizerStatus, UserRole, UserStatus } from "@tickethub/shared";
import { db } from "../../../database/db";
import { organizerProfiles, users } from "../../../database/schema";
import type { VerifiedOrganizerLookup } from "../domain/upload.ports";

export class DrizzleVerifiedOrganizerLookup implements VerifiedOrganizerLookup {
  async findVerifiedProfileId(userId: string): Promise<string | null> {
    const [profile] = await db
      .select({ id: organizerProfiles.id })
      .from(organizerProfiles)
      .innerJoin(users, eq(organizerProfiles.userId, users.id))
      .where(
        and(
          eq(organizerProfiles.userId, userId),
          eq(organizerProfiles.status, OrganizerStatus.VERIFIED),
          eq(users.role, UserRole.ORGANIZER),
          eq(users.status, UserStatus.ACTIVE),
        ),
      )
      .limit(1);
    return profile?.id ?? null;
  }
}
