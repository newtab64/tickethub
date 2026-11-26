import type {
  GetTicketQrResponse,
  MyTicketItem,
  MyTicketsListResponse,
} from "@tickethub/shared";
import {
  calculateEffectivePaidPrice,
  formatTicketSeatInfo,
} from "../../../shared-kernel/order-view";
import { assertQrIssuable } from "../domain/checkin-rules";
import type { MyTicketsQuery } from "../domain/ticketing.models";
import type {
  MyTicketsReader,
  QrTokenService,
  TicketQrReader,
} from "../domain/ticketing.ports";

/** Vi ve ca nhan: danh sach ve cua toi va ma QR dong Ed25519 (xoay 30 giay). */
export class BuyerTicketService {
  constructor(
    private readonly qrReader: TicketQrReader,
    private readonly qrTokens: QrTokenService,
    private readonly myTickets: MyTicketsReader,
  ) {}

  async getTicketQr(
    userId: string,
    role: string,
    ticketId: string,
  ): Promise<GetTicketQrResponse> {
    const ticket = assertQrIssuable(
      await this.qrReader.findForQr(ticketId),
      userId,
      role,
    );

    const { token, expiresAt, remainingSeconds } = this.qrTokens.sign({
      sub: ticket.id,
      eventId: ticket.eventId,
      orderId: ticket.orderId,
      userId: ticket.userId,
    });

    return {
      ticketId: ticket.id,
      qrToken: token,
      expiresAt: expiresAt.toISOString(),
      remainingSeconds,
    };
  }

  async getMyTickets(
    userId: string,
    query: MyTicketsQuery,
  ): Promise<MyTicketsListResponse> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const { total, rows } = await this.myTickets.list(userId, query);

    const items: MyTicketItem[] = rows.map((row) => {
      const price = Number(row.ticketTypePrice);
      return {
        id: row.ticketId,
        ticketCode: row.ticketCode,
        status: row.ticketStatus,
        price,
        effectivePaidPrice: calculateEffectivePaidPrice(
          price,
          Number(row.orderTotalAmount),
          Number(row.orderFinalAmount),
        ),
        checkedInAt: row.checkedInAt ? row.checkedInAt.toISOString() : null,
        orderId: row.orderId,
        orderCode: row.orderCode,
        eventId: row.eventId,
        eventTitle: row.eventTitle,
        eventBannerUrl: row.eventBannerUrl,
        eventStartTime: row.eventStartTime.toISOString(),
        eventEndTime: row.eventEndTime.toISOString(),
        eventVenueName: row.eventVenueName,
        eventCity: row.eventCity,
        eventStatus: row.eventStatus,
        ticketTypeId: row.ticketTypeId,
        ticketTypeName: row.ticketTypeName,
        isSeated: row.isSeated,
        seatInfo: formatTicketSeatInfo(
          row.isSeated,
          row.ticketTypeName,
          row.seatId
            ? {
                zoneName: row.seatZoneName!,
                rowLabel: row.seatRowLabel!,
                seatNumber: row.seatNumber!,
              }
            : null,
        ),
      } as MyTicketItem;
    });

    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    } as MyTicketsListResponse;
  }
}
