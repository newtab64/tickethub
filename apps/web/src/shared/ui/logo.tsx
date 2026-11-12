import Link from "next/link";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="tickethub Trang chủ"
      className={`inline-flex items-center select-none ${className ?? ""}`}
    >
      <span className="font-extrabold text-[24px] tracking-[-0.06em] leading-none text-foreground">
        ticket<span className="text-primary">hub</span>
      </span>
    </Link>
  );
}
