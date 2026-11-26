import type { ReactNode } from "react";
import { QueryProvider } from "@/shared/providers/query-provider";

export default function BuyerOrdersLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <QueryProvider>{children}</QueryProvider>;
}
