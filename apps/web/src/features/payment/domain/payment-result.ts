import { isRefundRejected } from "@tickethub/shared";
import type { paymentState } from "./order-checkout.ts";

type PaymentState = ReturnType<typeof paymentState>;

export type ResultState =
  PaymentState | "expired" | "refund_failed" | "unknown" | "error";

export interface ResultView {
  tone: "success" | "warning" | "destructive" | "neutral";
  title: string;
  /** Rỗng với trạng thái lỗi: trang hiện thông báo của hệ thống. */
  text: string;
  primary: { label: string; kind: "order" | "retry" | "orders" };
  secondary: {
    label: string;
    href: "order" | "/" | "/faq" | "/buyer/orders";
  };
}

const HOME = { label: "Về trang chủ", href: "/" } as const;
const HELP = { label: "Xem Trợ giúp", href: "/faq" } as const;
const RETRY = { label: "Kiểm tra lại", kind: "retry" } as const;

const VIEWS: Record<ResultState, ResultView> = {
  success: {
    tone: "success",
    title: "Thanh toán thành công",
    text: "Vé đã sẵn sàng. Mở mã QR khi đến cổng.",
    primary: { label: "Xem vé", kind: "order" },
    secondary: HOME,
  },
  processing: {
    tone: "warning",
    title: "Đang chờ xác nhận thanh toán",
    text: "Trang tự cập nhật. Nếu đã bị trừ tiền, đừng thanh toán lại.",
    primary: RETRY,
    secondary: { label: "Xem đơn hàng", href: "order" },
  },
  refund_pending: {
    tone: "warning",
    title: "Đang hoàn tiền",
    text: "Thanh toán đến muộn nên không cấp được vé. Tiền đang được hoàn lại cho bạn.",
    primary: { label: "Xem tiến độ hoàn tiền", kind: "order" },
    secondary: HELP,
  },
  failed: {
    tone: "destructive",
    title: "Thanh toán không thành công",
    text: "Nếu đã bị trừ tiền, hãy liên hệ hỗ trợ và gửi kèm mã đơn.",
    primary: { label: "Xem đơn hàng", kind: "order" },
    secondary: HELP,
  },
  // Tiền trả sát hạn có thể được xác nhận muộn, nên vẫn cho kiểm tra lại.
  expired: {
    tone: "destructive",
    title: "Thanh toán không thành công",
    text: "Nếu đã bị trừ tiền, đừng thanh toán lại. Hãy liên hệ hỗ trợ và gửi kèm mã đơn.",
    primary: RETRY,
    secondary: { label: "Xem đơn hàng", href: "order" },
  },
  refund_failed: {
    tone: "destructive",
    title: "Chưa hoàn được tiền",
    text: "Hoàn tiền chưa thực hiện được. Hãy liên hệ hỗ trợ kèm mã đơn.",
    primary: { label: "Xem đơn hàng", kind: "order" },
    secondary: HELP,
  },
  refunded: {
    tone: "neutral",
    title: "Đơn đã hủy toàn bộ vé",
    text: "Xem tiến độ hoàn tiền trong chi tiết đơn.",
    primary: { label: "Xem chi tiết đơn", kind: "order" },
    secondary: HOME,
  },
  unknown: {
    tone: "neutral",
    title: "Chưa xác định được đơn",
    text: "Hãy kiểm tra trong Vé của tôi trước khi thanh toán lại.",
    primary: { label: "Xem Vé của tôi", kind: "orders" },
    secondary: HELP,
  },
  error: {
    tone: "neutral",
    title: "Chưa kiểm tra được thanh toán",
    text: "",
    primary: RETRY,
    secondary: { label: "Xem Vé của tôi", href: "/buyer/orders" },
  },
};

/** Nội dung trang kết quả theo trạng thái đơn. */
export function resultView(state: ResultState): ResultView {
  return VIEWS[state];
}

/** Tách các trường hợp mà trạng thái đơn chưa nói đủ cho người đã trả tiền. */
export function detailedState(
  state: PaymentState,
  status: string,
  refunds: { status: string }[],
): ResultState {
  if (status === "EXPIRED") return "expired";
  if (state === "refund_pending" && isRefundRejected(refunds)) {
    return "refund_failed";
  }
  return state;
}
