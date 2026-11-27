import type { ReactNode } from "react";
import { QueryProvider } from "@/shared/providers/query-provider";

export default function BookingLayout({ children }: { children: ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
