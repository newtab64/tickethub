import { proxyBooking } from "@/lib/api/booking-proxy";

export async function POST(request: Request) {
  return proxyBooking(request, "hold");
}
