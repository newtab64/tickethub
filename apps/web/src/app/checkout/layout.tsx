import type { ReactNode } from "react";
import { QueryProvider } from "@/shared/providers/query-provider";

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
