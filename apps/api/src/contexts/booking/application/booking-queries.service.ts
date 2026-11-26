import { bookingErrors } from "../domain/booking.errors";
import type { BookingOrderView } from "../domain/booking.models";
import type { BookingReader } from "../domain/booking.ports";

export class BookingQueries {
  constructor(private readonly reader: BookingReader) {}

  /** Chi chu don hang xem duoc (chong IDOR); kem so giay con lai cua phien giu cho. */
  async getOrderById(
    userId: string,
    orderId: string,
  ): Promise<BookingOrderView & { remainingSeconds: number }> {
    const order = await this.reader.findOwnedOrderDetail(orderId, userId);
    if (!order) throw bookingErrors.orderNotFound();
    const remainingSeconds = Math.max(
      0,
      Math.floor((order.expiresAt.getTime() - Date.now()) / 1000),
    );
    return { ...order, remainingSeconds };
  }
}
