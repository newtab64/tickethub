// apps/web/src/app/(admin)/layout.tsx
import { AdminSidebar } from "@/features/moderation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen flex overflow-hidden bg-muted/30 text-foreground">
      <AdminSidebar />
      <main className="flex-1 min-w-0 flex flex-col">{children}</main>
    </div>
  );
}
