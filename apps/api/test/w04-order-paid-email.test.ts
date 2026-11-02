import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { OrderPaidPayloadSchema } from "../src/jobs/email.types";
import { composeOrderPaidEmail } from "../src/jobs/email.sender";

function sample() {
  return {
    orderId: randomUUID(),
    orderCode: "ORD-W04-TEST",
    userId: randomUUID(),
    eventId: randomUUID(),
    transactionId: randomUUID(),
    transactionRef: "BE2TEST1234",
    provider: "VNPAY" as const,
    amount: "650000.00",
    ticketIds: [randomUUID(), randomUUID()],
    paidAt: new Date().toISOString(),
  };
}

test("ORDER_PAID payload accepts verified settlement event", () => {
  const parsed = OrderPaidPayloadSchema.parse(sample());
  assert.equal(parsed.provider, "VNPAY");
  assert.equal(parsed.ticketIds.length, 2);
});

test("ORDER_PAID message confirms tickets without QR/JWT", () => {
  const payload = OrderPaidPayloadSchema.parse(sample());
  const message = composeOrderPaidEmail(payload, ["TK001", "TK002"]);
  assert.match(message.subject, /ORD-W04-TEST/);
  assert.match(message.text, /650000\.00 VND/);
  assert.match(message.text, /TK001, TK002/);
  assert.doesNotMatch(message.text, /eyJhbGci/);
});

test("ORDER_PAID rejects incomplete settlement evidence", () => {
  assert.equal(
    OrderPaidPayloadSchema.safeParse({ ...sample(), ticketIds: [] }).success,
    false,
  );
  assert.equal(
    OrderPaidPayloadSchema.safeParse({ ...sample(), amount: "-1" }).success,
    false,
  );
});
