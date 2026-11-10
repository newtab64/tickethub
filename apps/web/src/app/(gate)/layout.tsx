import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export default function GateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-muted text-foreground">
      <header className="border-b border-border bg-card px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
        <div className="flex items-center gap-5">
          <Logo />
          <span className="h-4 w-px bg-border hidden sm:block" />
          <span className="text-[14px] font-bold text-foreground hidden sm:inline">
            Cổng soát vé
          </span>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="size-4" /> Trang chủ
        </Link>
      </header>
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[960px] mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
