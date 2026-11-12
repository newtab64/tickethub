import {
  RefundPolicyType,
  type RefundExecuteRequest,
  type RefundExecuteResponse,
} from "@tickethub/shared";
import { computeRefundPercentage } from "../domain/refund-policy";
import {
  calculateTicketRefundBreakdown,
  type TicketToRefund,
} from "../domain/refund-calculator";
import {
  assertCanAccessOrder,
  assertOrderPaid,
  assertPercentageEligible,
  assertTicketsRefundable,
  isPartialRefund,
  resolveOrderStatusAfterRefund,
  type RefundActor,
} from "../domain/refund-rules";
import { refundErrors } from "../domain/refund.errors";
import type {
  RefundNotifier,
  RefundQueryPort,
  RefundUnitOfWork,
} from "../domain/refund.ports";

/**
 * Thu hoi ve nguyen tu trong mot Database Transaction, ghi outbox
 * REFUND_REQUESTED va audit log. Khong goi HTTP ben thu ba trong transaction.
 */
export class RequestRefundUseCase {
  constructor(
    private readonly query: RefundQueryPort,
    private readonly unitOfWork: RefundUnitOfWork,
    private readonly notifier?: RefundNotifier,
  ) {}

  async execute(
    actor: RefundActor,
    dto: RefundExecuteRequest,
    idempotencyKey: string,
  ): Promise<RefundExecuteResponse> {
    const replay = await this.query.findIdempotentResponse(idempotencyKey);
    if (replay) return replay;

    const outcome = await this.unitOfWork.run(async (tx) => {
      const order = await tx.lockOrder(dto.orderId);
      if (!order) throw refundErrors.orderNotFound();
      assertCanAccessOrder(order, actor);
      assertOrderPaid(order);

      const requestedTickets = await tx.lockTickets(order.id, dto.ticketIds);
      assertTicketsRefundable(requestedTickets, dto.ticketIds);

      const event = await tx.findEvent(order.eventId);
      if (!event) throw refundErrors.eventNotFound();

      const policyType =
        (event.refundPolicyType as RefundPolicyType) ||
        RefundPolicyType.FLEXIBLE;
      const now = new Date();
      const refundPercentage = computeRefundPercentage(
        policyType,
        event.startTime,
        now,
      );
      assertPercentageEligible(refundPercentage);

      const totalPreviouslyRefunded = await tx.sumRefundedAmount(order.id);

      const ticketsToRefund: TicketToRefund[] = requestedTickets.map((t) => ({
        ticketId: t.id,
        ticketCode: t.ticketCode,
        unitPrice: t.unitPrice,
      }));
      const breakdown = calculateTicketRefundBreakdown({
        tickets: ticketsToRefund,
        totalAmount: order.totalAmount,
        finalAmount: order.finalAmount,
        refundPercentage,
        totalPreviouslyRefunded,
      });

      await tx.cancelTickets(dto.ticketIds, now);

      const seatIds = requestedTickets
        .map((t) => t.seatId)
        .filter((id): id is string => id !== null);
      if (seatIds.length > 0) await tx.releaseSeats(seatIds, now);

      const gaCounts = new Map<string, number>();
      for (const t of requestedTickets) {
        if (t.seatId === null) {
          gaCounts.set(t.ticketTypeId, (gaCounts.get(t.ticketTypeId) || 0) + 1);
        }
      }
      if (gaCounts.size > 0) await tx.decrementSoldCount(gaCounts, now);

      const refundIds = await tx.insertRefunds(
        order.id,
        dto.reason,
        breakdown.items.map((item) => ({
          ticketId: item.ticketId,
          amount: item.refundAmount,
          idempotencyKey: `${idempotencyKey}:${item.ticketId}`,
        })),
      );

      const uncancelled = await tx.countUncancelledTickets(order.id);
      const orderStatus = resolveOrderStatusAfterRefund(uncancelled);
      if (uncancelled === 0) await tx.markOrderRefunded(order.id, now);

      const isPartial = isPartialRefund(
        totalPreviouslyRefunded,
        breakdown.totalRefundAmount,
        order.finalAmount,
      );

      await tx.enqueueRefundRequested({
        orderId: order.id,
        orderCode: order.orderCode,
        refundIds,
        ticketIds: dto.ticketIds,
        userId: order.userId,
        eventId: order.eventId,
        amount: breakdown.totalRefundAmount,
        reason: dto.reason,
        isPartial,
        requestedAt: now.toISOString(),
      });

      await tx.writeAuditLog({
        actorId: actor.userId,
        actorRole: actor.role,
        orderId: order.id,
        changes: {
          orderId: order.id,
          ticketIds: dto.ticketIds,
          refundAmount: breakdown.totalRefundAmount,
          reason: dto.reason,
          isPartial,
          newOrderStatus: orderStatus,
          timestamp: now.toISOString(),
        },
      });

      const response: RefundExecuteResponse = {
        refundId: refundIds[0] || "",
        refundIds,
        orderId: order.id,
        status: "PROCESSING",
        refundAmount: breakdown.totalRefundAmount,
        cancelledTicketCount: dto.ticketIds.length,
        orderStatus,
      };
      await tx.saveIdempotentResponse(idempotencyKey, actor.userId, response);

      const seatIdsByEvent = new Map<string, string[]>();
      for (const t of requestedTickets) {
        if (t.seatId && t.eventId) {
          const list = seatIdsByEvent.get(t.eventId) || [];
          list.push(t.seatId);
          seatIdsByEvent.set(t.eventId, list);
        }
      }
      return { response, eventId: order.eventId, seatIdsByEvent };
    });

    await this.notifier?.ticketsReleased({
      eventId: outcome.eventId,
      seatIdsByEvent: outcome.seatIdsByEvent,
    });
    return outcome.response;
  }
}
