export type OrderTone = "success" | "warning" | "destructive" | "neutral";

const TONES: Record<string, OrderTone> = {
  PENDING: "warning",
  PAID: "success",
  PAYMENT_EXPIRED_REFUND_PENDING: "warning",
  FAILED: "destructive",
};

/** Màu nhãn trạng thái trong danh sách đơn. */
export function orderTone(status: string): OrderTone {
  return TONES[status] ?? "neutral";
}
