import Link from "next/link";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="TicketHub Trang chủ"
      className={`inline-flex items-center select-none group ${className ?? ""}`}
    >
      <div className="relative inline-flex items-center justify-center rounded-[10px] bg-primary px-3 py-1.5 text-white shadow-2xs group-hover:bg-emerald-700 transition-colors">
        <span className="font-extrabold text-[18px] tracking-[-0.03em] leading-none">
          TicketHub
        </span>
      </div>
    </Link>
  );
}
