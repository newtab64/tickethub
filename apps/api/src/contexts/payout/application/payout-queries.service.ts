import type {
  OrganizerPayoutQueryDto,
  PayoutFilterQueryDto,
} from "../domain/payout.models";
import { payoutErrors } from "../domain/payout.errors";
import type { PayoutQueryPort } from "../domain/payout.ports";

export class PayoutQueries {
  constructor(private readonly query: PayoutQueryPort) {}

  getAdminPayouts(filter: PayoutFilterQueryDto) {
    return this.query.listForAdmin(
      filter,
      filter.page ?? 1,
      filter.limit ?? 20,
    );
  }

  async getOrganizerPayouts(userId: string, filter: OrganizerPayoutQueryDto) {
    const profileId = await this.query.findOrganizerProfileId(userId);
    if (!profileId) throw payoutErrors.organizerProfileRequired();
    return this.query.listForOrganizer(
      profileId,
      filter.page ?? 1,
      filter.limit ?? 20,
    );
  }
}
