import type { OrderDetailRecord, OrderListPage } from "./buyer-order.models";

export interface BuyerOrderReader {
  listByUser(
    userId: string,
    status: string | undefined,
    page: number,
    limit: number,
  ): Promise<OrderListPage>;
  findDetail(orderId: string): Promise<OrderDetailRecord | null>;
}
