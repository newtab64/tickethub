// apps/web/src/app/not-found.tsx
import Link from "next/link";
import { Ticket } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-white text-slate-900 px-4 sm:px-8 py-6">
      <header className="max-w-7xl w-full mx-auto">
        <Logo />
      </header>

      <main className="max-w-md w-full mx-auto text-center space-y-4 my-auto py-12">
        <div className="size-12 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-primary flex items-center justify-center mx-auto">
          <Ticket className="size-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">
          Không tìm thấy trang này
        </h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          Đường dẫn bạn truy cập không tồn tại hoặc sự kiện đã kết thúc.
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center h-10 px-5 rounded-full bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Về trang chủ tickethub
          </Link>
        </div>
      </main>

      <footer className="max-w-7xl w-full mx-auto text-center text-xs text-slate-400">
        © 2026 tickethub Vietnam
      </footer>
    </div>
  );
}
