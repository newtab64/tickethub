import { proxyBooking } from "@/features/booking/server";

export async function POST(request: Request) {
  return proxyBooking(request, "release");
}
