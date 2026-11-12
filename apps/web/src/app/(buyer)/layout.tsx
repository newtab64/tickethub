// apps/web/src/app/(buyer)/layout.tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/shared/ui/logo";

export default function BuyerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[#f5f7f8] text-[#141d23]">
      <header className="border-b border-[#dfe3e5] bg-white px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
        <div className="flex items-center gap-5">
          <Logo />
          <span className="h-4 w-px bg-[#dfe3e5] hidden sm:block" />
          <span className="text-[14px] font-bold text-[#141d23] hidden sm:inline">
            Vé của tôi
          </span>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#606970] hover:text-primary transition-colors"
        >
          <ArrowLeft className="size-4" /> Khám phá sự kiện
        </Link>
      </header>
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[960px] mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
