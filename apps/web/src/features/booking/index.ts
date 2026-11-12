// API cong khai cua feature booking (chi phan client; proxy may chu o ./server)
export {
  calculateOrderSubtotal,
  computeRemainingSeconds,
  getHoldErrorInfo,
  isValidTicketQuantity,
  isZoneAvailable,
  formatCountdown,
  insufficientTicketsMessage,
  nowMs,
  parseHoldSession,
} from "./domain/booking-rules";
export type { HoldErrorInfo } from "./domain/booking-rules";
export { BookingPage } from "./ui/booking-page";
