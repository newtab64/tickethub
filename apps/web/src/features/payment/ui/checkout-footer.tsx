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
    // pb-20 trên mobile chừa chỗ cho thanh thanh toán nổi.
    <footer className="mx-auto max-w-[1248px] px-4 pt-1 pb-20 text-[13px] text-muted-foreground sm:px-6 lg:pb-6 short:pb-3">
      <p className="text-center">
        <ShieldCheck
          aria-hidden="true"
          className="mr-2 inline size-4 align-[-3px] text-primary"
        />
        Vé chính hãng. Nếu đã trừ tiền mà không thể cấp vé, hệ thống hoàn tiền
        cho bạn.
      </p>
      <div
        data-testid="checkout-footer-row"
        className="mt-6 flex flex-col-reverse items-center gap-2 border-t border-checkout-border pt-4 lg:flex-row lg:justify-between lg:gap-4 short:mt-3 short:pt-2"
      >
        <p>© 2026 tickethub</p>
        <nav
          aria-label="Chính sách và trợ giúp"
          className="grid w-full grid-cols-2 justify-items-center gap-x-4 gap-y-1 text-center font-medium lg:flex lg:w-auto lg:gap-x-7"
        >
          {LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex min-h-10 items-center transition-colors hover:text-primary lg:min-h-8"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
