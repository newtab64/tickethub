import { Suspense } from "react";
import { PublicLayout } from "@/features/event";
import { HoldExpiredNotice } from "@/shared/ui/hold-expired-notice";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <PublicLayout>
      <Suspense>
        <HoldExpiredNotice />
      </Suspense>
      {children}
    </PublicLayout>
  );
}
