import {
  RefundPolicyType,
  type RefundPreviewRequest,
  type RefundPreviewResponse,
} from "@tickethub/shared";
import {
  computeDaysUntilEvent,
  computeRefundPercentage,
} from "../domain/refund-policy";
import {
  calculateTicketRefundBreakdown,
  type TicketToRefund,
} from "../domain/refund-calculator";
import {
  assertCanAccessOrder,
  assertOrderPaid,
  assertPercentageEligible,
  assertTicketsRefundable,
  type RefundActor,
} from "../domain/refund-rules";
import { refundErrors } from "../domain/refund.errors";
import type { RefundQueryPort } from "../domain/refund.ports";

/** Xem truoc so tien hoan tra (chi doc, chong IDOR). */
export class PreviewRefundUseCase {
  constructor(private readonly query: RefundQueryPort) {}

  async execute(
    actor: RefundActor,
    dto: RefundPreviewRequest,
  ): Promise<RefundPreviewResponse> {
    const found = await this.query.findOrderWithEvent(dto.orderId);
    if (!found) throw refundErrors.orderNotFound();
    const { order, event } = found;

    assertCanAccessOrder(order, actor);
    assertOrderPaid(order);

    const policyType =
      (event?.refundPolicyType as RefundPolicyType) ||
      RefundPolicyType.FLEXIBLE;
    const now = new Date();
    const eventStartTime = event?.startTime || new Date();
    const refundPercentage = computeRefundPercentage(
      policyType,
      eventStartTime,
      now,
    );
    const daysUntilEvent = computeDaysUntilEvent(eventStartTime, now);
    assertPercentageEligible(refundPercentage);

    const requestedTickets = await this.query.findOrderTickets(
      order.id,
      dto.ticketIds,
    );
    assertTicketsRefundable(requestedTickets, dto.ticketIds);

    const totalPreviouslyRefunded = await this.query.sumRefundedAmount(
      order.id,
    );

    const ticketsToRefund: TicketToRefund[] = requestedTickets.map((t) => ({
      ticketId: t.id,
      ticketCode: t.ticketCode,
      seatLabel: t.seatLabel,
      unitPrice: t.unitPrice,
    }));

    const breakdown = calculateTicketRefundBreakdown({
      tickets: ticketsToRefund,
      totalAmount: order.totalAmount,
      finalAmount: order.finalAmount,
      refundPercentage,
      totalPreviouslyRefunded,
    });

    return {
      orderId: order.id,
      policyType,
      daysUntilEvent,
      refundPercentage,
      items: breakdown.items,
      totalRefundAmount: breakdown.totalRefundAmount,
      totalFeeDeducted: breakdown.totalFeeDeducted,
    };
  }
}
