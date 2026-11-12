// apps/web/src/app/(auth)/layout.tsx
import { AuthProvider, AuthLayout } from "@/features/identity";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthLayout>{children}</AuthLayout>
    </AuthProvider>
  );
}
