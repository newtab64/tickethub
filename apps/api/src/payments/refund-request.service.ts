import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import { and, eq, inArray } from "drizzle-orm";

import {
  EventStatus,
  OrderStatus,
  PaymentProvider,
  RefundStatus,
  TicketStatus,
  TransactionStatus,
} from "@tickethub/shared";

import { db } from "../database/db";

import {
  events,
  orders,
  orderItems,
  refunds,
  tickets,
  transactions,
} from "../database/schema";

import { evaluateRefundPolicy } from "./refund-policy";
import { parseVndAmount } from "./vnpay-amount";
import { enqueueRefund } from "../jobs/refund.queue";
interface CreateRefundInput {
  userId: string;
  orderId: string;
  idempotencyKey: string;
  reason: string;
}

@Injectable()
export class RefundRequestService {
  private readonly logger = new Logger(RefundRequestService.name);

  async createFullOrderRefund(input: CreateRefundInput) {
    // A. Validate input
    const reason = input.reason.trim();

    const uuidV4 =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidV4.test(input.idempotencyKey)) {
      throw new BadRequestException("Invalid Idempotency-Key");
    }

    if (!reason || reason.length > 500) {
      throw new BadRequestException("Invalid refund reason");
    }
    const result = await db.transaction(async (tx) => {
      // B. Lock Order + replay idempotency
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1)
        .for("update");

      if (!order || order.userId !== input.userId) {
        throw new NotFoundException("Order not found");
      }
      const [replayed] = await tx
        .select()
        .from(refunds)
        .where(eq(refunds.idempotencyKey, input.idempotencyKey))
        .limit(1);

      if (replayed) {
        if (
          replayed.orderId !== order.id ||
          replayed.ticketId !== null ||
          replayed.reason !== reason
        ) {
          throw new ConflictException(
            "Idempotency-Key already used for another request",
          );
        }

        return {
          refundId: replayed.id,
          orderId: replayed.orderId,
          amount: replayed.amount,
          status: replayed.status,
          idempotent: true,
        };
      }

      if (order.status !== OrderStatus.PAID) {
        throw new ConflictException("Order is not PAID");
      }
      // C. Validate payment + tickets
      const [payment] = await tx
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.orderId, order.id),
            eq(transactions.provider, PaymentProvider.VNPAY),
            eq(transactions.status, TransactionStatus.SUCCESS),
          ),
        )
        .limit(1)
        .for("update");

      if (!payment) {
        throw new ConflictException("No successful VNPay transaction");
      }

      if (payment.amount !== order.finalAmount) {
        throw new ConflictException("Payment amount mismatch");
      }
      const orderTickets = await tx
        .select()
        .from(tickets)
        .where(eq(tickets.orderId, order.id))
        .orderBy(tickets.id)
        .for("update");

      const items = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));

      const expectedTicketCount = items.reduce(
        (total, item) => total + item.quantity,
        0,
      );

      if (
        expectedTicketCount <= 0 ||
        orderTickets.length !== expectedTicketCount ||
        orderTickets.some(
          (ticket) =>
            ticket.status !== TicketStatus.SOLD ||
            ticket.checkedInAt !== null ||
            ticket.userId !== order.userId ||
            ticket.eventId !== order.eventId,
        )
      ) {
        throw new ConflictException(
          "Order tickets are not eligible for full refund",
        );
      }
      const existingRefunds = await tx
        .select({ id: refunds.id })
        .from(refunds)
        .where(
          and(
            eq(refunds.orderId, order.id),
            inArray(refunds.status, [
              RefundStatus.PENDING,
              RefundStatus.PROCESSING,
              RefundStatus.COMPLETED,
            ]),
          ),
        )
        .limit(1);

      if (existingRefunds.length > 0) {
        throw new ConflictException(
          "Order already has an active or completed refund",
        );
      }
      // D. Validate policy + calculate amount
      const [event] = await tx
        .select()
        .from(events)
        .where(eq(events.id, order.eventId))
        .limit(1);

      if (!event) {
        throw new NotFoundException("Event not found");
      }

      if (event.status !== EventStatus.PUBLISHED) {
        throw new ConflictException("Event requires refund review");
      }

      const policy = evaluateRefundPolicy({
        orderStatus: order.status,
        ticketStatus: TicketStatus.SOLD,
        eventStatus: event.status,
        policyType: event.refundPolicyType,
        rawRules: event.refundPolicyRules,
        eventStart: event.startTime,
        now: new Date(),
      });

      if (policy.decision !== "ELIGIBLE") {
        throw new ConflictException(`Refund not eligible: ${policy.reason}`);
      }
      const paidVnd = parseVndAmount(order.finalAmount);

      if (paidVnd === null) {
        throw new ConflictException("Invalid paid amount");
      }

      const refundVnd =
        (BigInt(paidVnd) * BigInt(policy.refundPercentage)) / 100n;

      if (refundVnd <= 0n) {
        throw new ConflictException("Refund amount is zero");
      }

      const refundAmount = `${refundVnd.toString()}.00`;
      // E. Insert Refund PENDING
      const [created] = await tx
        .insert(refunds)
        .values({
          orderId: order.id,
          ticketId: null,
          amount: refundAmount,
          reason,
          status: RefundStatus.PENDING,
          idempotencyKey: input.idempotencyKey,
          needsReconciliation: false,
        })
        .onConflictDoNothing()
        .returning();

      if (!created) {
        throw new ConflictException(
          "Refund already exists or Idempotency-Key conflicts",
        );
      }

      return {
        refundId: created.id,
        orderId: created.orderId,
        amount: created.amount,
        status: created.status,
        idempotent: false,
      };
    });
    if (result.status === RefundStatus.PENDING) {
      try {
        await enqueueRefund(result.refundId);
      } catch {
        this.logger.warn(`Refund enqueue deferred: ${result.refundId}`);
      }
    }

    return result;
  }
}
