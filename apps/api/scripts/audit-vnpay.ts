/** Read-only audit for isolated TicketHub 2E test database. No mutations. */
import { env } from "../src/config/env.config";
import { sqlClient } from "../src/database/db";

async function main() {
  const dbUrl = new URL(env.DATABASE_URL);
  const dbName = decodeURIComponent(dbUrl.pathname.slice(1));
  if (
    env.NODE_ENV !== "test" ||
    !dbName.endsWith("_test") ||
    !["localhost", "127.0.0.1", "::1"].includes(dbUrl.hostname)
  ) {
    throw new Error("Audit requires local _test database and NODE_ENV=test");
  }
  const ordersByStatus = await sqlClient`
    SELECT status, COUNT(*)::int AS count FROM orders GROUP BY status ORDER BY status
  `;
  const transactionsByStatus = await sqlClient`
    SELECT status, COUNT(*)::int AS count FROM transactions GROUP BY status ORDER BY status
  `;
  const refundsByStatus = await sqlClient`
    SELECT status, COUNT(*)::int AS count FROM refunds GROUP BY status ORDER BY status
  `;
  const paidWithoutTicket = await sqlClient`
    SELECT COUNT(*)::int AS count FROM orders o
    WHERE o.status = 'PAID' AND NOT EXISTS (
      SELECT 1 FROM tickets t WHERE t.order_id = o.id
    )
  `;
  const duplicatedActiveSeat = await sqlClient`
    SELECT COUNT(*)::int AS count FROM (
      SELECT t.seat_id FROM tickets t
      WHERE t.seat_id IS NOT NULL AND t.status = 'SOLD'
      GROUP BY t.seat_id HAVING COUNT(*) > 1
    ) s
  `;
  const staleOutbox = await sqlClient`
    SELECT COUNT(*)::int AS count FROM outbox
    WHERE event_type='ORDER_PAID' AND status <> 'COMPLETED'
  `;
  const refundsNeedingReconciliation = await sqlClient`
    SELECT COUNT(*)::int AS count FROM refunds
    WHERE needs_reconciliation = TRUE AND status = 'PROCESSING'
  `;
  console.log(
    JSON.stringify(
      {
        database: dbName,
        ordersByStatus,
        transactionsByStatus,
        refundsByStatus,
        paidWithoutTicket: paidWithoutTicket[0]?.count ?? 0,
        duplicatedActiveSeat: duplicatedActiveSeat[0]?.count ?? 0,
        uncompletedPaidEmailOutbox: staleOutbox[0]?.count ?? 0,
        refundsNeedingReconciliation:
          refundsNeedingReconciliation[0]?.count ?? 0,
      },
      null,
      2,
    ),
  );
}
main()
  .catch((err) => {
    console.error("[2E audit]", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sqlClient.end();
  });
