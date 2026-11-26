import { reconcile } from "../domain/reconciliation";
import type {
  ReconciliationQueryDto,
  ReconciliationReport,
} from "../domain/payout.models";
import type { ReconciliationReader } from "../domain/payout.ports";

export class ReconciliationQueries {
  constructor(private readonly reader: ReconciliationReader) {}

  async getReconciliations(
    query: ReconciliationQueryDto,
  ): Promise<ReconciliationReport> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const orders = await this.reader.listOrders(query.eventId);
    const orderIds = orders.map((o) => o.id);

    // Loc theo su kien chua co don hang: khong can truy van them
    const empty = Boolean(query.eventId) && orderIds.length === 0;
    const scope = query.eventId ? orderIds : undefined;

    const transactions = empty
      ? []
      : await this.reader.listVnpayTransactions(scope);
    const refunds = empty ? [] : await this.reader.listActiveRefunds(scope);

    return reconcile({
      orders,
      transactions,
      refunds,
      scopedToEvent: Boolean(query.eventId),
      status: query.status,
      page,
      limit,
    });
  }
}
