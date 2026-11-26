import {
  OrderStatus,
  UserRole,
  type BuyerOrderDetailResponse,
  type BuyerOrderDetailTicketItem,
  type BuyerOrderListResponse,
} from "@tickethub/shared";
import { bookingErrors } from "../domain/booking.errors";
import type { BuyerOrderQuery } from "../domain/buyer-order.models";
import type { BuyerOrderReader } from "../domain/buyer-order.ports";
import {
  calculateEffectivePaidPrice,
  formatTicketSeatInfo,
} from "../../../shared-kernel/order-view";

export class BuyerOrderQueries {
  constructor(private readonly reader: BuyerOrderReader) {}

  async listBuyerOrders(
    userId: string,
    query: BuyerOrderQuery,
  ): Promise<BuyerOrderListResponse> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const { total, orders } = await this.reader.listByUser(
      userId,
      query.status,
      page,
      limit,
    );

    const items = orders.map((order) => ({
      id: order.id,
      orderCode: order.orderCode,
      eventId: order.eventId,
      eventTitle: order.event.title,
      eventBannerUrl: order.event.bannerUrl,
      eventStartTime: order.event.startTime.toISOString(),
      eventVenueName: order.event.venueName,
      totalAmount: Number(order.totalAmount),
      discountAmount: Number(order.discountAmount),
      finalAmount: Number(order.finalAmount),
      status: order.status,
      expiresAt: order.expiresAt.toISOString(),
      paidAt: order.paidAt ? order.paidAt.toISOString() : null,
      createdAt: order.createdAt.toISOString(),
      ticketCount: (order.items || []).reduce(
        (sum, item) => sum + (item.quantity || 0),
        0,
      ),
    }));

    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    } as BuyerOrderListResponse;
  }

  async getBuyerOrderDetail(
    userId: string,
    role: string,
    orderId: string,
  ): Promise<BuyerOrderDetailResponse> {
    const order = await this.reader.findDetail(orderId);
    if (!order) throw bookingErrors.orderNotFound();
    if (order.userId !== userId && role !== UserRole.ADMIN) {
      throw bookingErrors.accessDenied();
    }

    const items = (order.items || []).map((item) => ({
      id: item.id,
      ticketTypeId: item.ticketTypeId,
      ticketTypeName: item.ticketType.name,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      subtotal: Number(item.subtotal),
    }));

    const isPaidOrRefunded =
      order.status === OrderStatus.PAID ||
      order.status === OrderStatus.REFUNDED;

    let tickets: BuyerOrderDetailTicketItem[] = [];
    if (isPaidOrRefunded && order.tickets && order.tickets.length > 0) {
      tickets = order.tickets.map((t) => {
        const matching = order.items.find(
          (i) => i.ticketTypeId === t.ticketTypeId,
        );
        const unitPrice = matching
          ? Number(matching.unitPrice)
          : Number(t.ticketType.price);
        return {
          id: t.id,
          ticketCode: t.ticketCode,
          ticketTypeId: t.ticketTypeId,
          ticketTypeName: t.ticketType.name,
          isSeated: t.ticketType.isSeated,
          seatInfo: formatTicketSeatInfo(
            t.ticketType.isSeated,
            t.ticketType.name,
            t.seat,
          ),
          price: unitPrice,
          effectivePaidPrice: calculateEffectivePaidPrice(
            unitPrice,
            Number(order.totalAmount),
            Number(order.finalAmount),
          ),
          status: t.status,
          checkedInAt: t.checkedInAt ? t.checkedInAt.toISOString() : null,
        } as BuyerOrderDetailTicketItem;
      });
    }

    const refunds = (order.refunds || []).map((r) => ({
      id: r.id,
      amount: Number(r.amount),
      status: r.status,
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
    }));

    return {
      id: order.id,
      orderCode: order.orderCode,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      discountAmount: Number(order.discountAmount),
      finalAmount: Number(order.finalAmount),
      voucherCode: order.voucherCode,
      expiresAt: order.expiresAt.toISOString(),
      paidAt: order.paidAt ? order.paidAt.toISOString() : null,
      createdAt: order.createdAt.toISOString(),
      event: {
        id: order.event.id,
        title: order.event.title,
        slug: order.event.slug,
        bannerUrl: order.event.bannerUrl,
        venueName: order.event.venueName,
        venueAddress: order.event.venueAddress,
        city: order.event.city,
        startTime: order.event.startTime.toISOString(),
        endTime: order.event.endTime.toISOString(),
        status: order.event.status,
      },
      items,
      tickets,
      refunds,
    } as BuyerOrderDetailResponse;
  }
}
