import Link from "next/link";
import { ShieldCheck } from "lucide-react";

const LINKS = [
  { href: "/faq?tab=terms", label: "Điều khoản sử dụng" },
  { href: "/faq?tab=privacy", label: "Chính sách bảo mật" },
  { href: "/faq?tab=refund", label: "Bảo vệ vé" },
  { href: "/faq", label: "Trợ giúp" },
];

/** Cam kết và chân trang; canh thẳng mép thẻ thanh toán. */
export function CheckoutFooter() {
  return (
    // Trên mobile chừa chỗ cho thanh thanh toán nổi.
    <footer className="mx-auto w-full max-w-232 px-4 pt-1 pb-22 text-[13px] text-muted-foreground sm:px-6 lg:pb-3">
      <p className="text-center">
        <ShieldCheck
          aria-hidden="true"
          className="mr-2 inline size-4 align-[-3px]"
        />
        Vé chính hãng. Nếu đã trừ tiền mà không thể cấp vé, hệ thống hoàn tiền
        cho bạn.
      </p>
      <div
        data-testid="checkout-footer-row"
        className="mt-2 flex flex-col-reverse items-center gap-2 border-t border-checkout-border pt-2 lg:flex-row lg:justify-between lg:gap-4"
      >
        <p>© 2026 tickethub</p>
        <nav
          aria-label="Chính sách và trợ giúp"
          className="flex flex-wrap justify-center gap-x-4 lg:gap-x-7"
        >
          {LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
