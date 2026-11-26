import { useState, type ReactNode, type Ref } from "react";
import { Check, CreditCard, Landmark, QrCode } from "lucide-react";
import { useSession } from "@/features/identity";
import { Button } from "@/shared/ui/button";
import { CheckoutCell, checkoutGroup } from "./checkout-cell";

// Chỉ để tham khảo: người mua chọn phương thức tại cổng VNPay.
const METHODS = [
  { name: "VNPay-QR", hint: "Quét bằng app ngân hàng", Icon: QrCode },
  { name: "Thẻ nội địa", hint: "ATM", Icon: Landmark },
  { name: "Thẻ quốc tế", hint: "Visa, Mastercard", Icon: CreditCard },
];
const row = "flex min-h-13 flex-1 items-center gap-3 px-4 short:min-h-11.5";

/** Nửa phải: người nhận, phương thức, mã giảm giá và nút thanh toán. */
export function PaymentPanel({
  voucherCode,
  disabled,
  payDisabled,
  paying,
  error,
  onPay,
  payButtonRef,
}: {
  voucherCode: string | null;
  disabled: boolean;
  payDisabled: boolean;
  paying: boolean;
  error: ReactNode;
  onPay: () => void;
  payButtonRef: Ref<HTMLButtonElement>;
}) {
  const { user } = useSession();
  const [voucher, setVoucher] = useState("");
  const [message, setMessage] = useState("");
  return (
    <section
      aria-label="Thông tin thanh toán"
      className="contents border-border lg:row-span-4 lg:grid lg:grid-rows-subgrid lg:border-l"
    >
      <CheckoutCell title="Người nhận vé" className="order-3">
        <dl className={checkoutGroup}>
          {[
            { label: "Họ và tên", value: user?.fullName },
            { label: "Email", value: user?.email },
          ].map(({ label, value }) => (
            <div key={label} className={row}>
              <dt className="w-20 shrink-0 text-[13px] text-muted-foreground lg:w-22">
                {label}
              </dt>
              <dd className="min-w-0 flex-1 font-medium break-words">
                {value || "Chưa cập nhật"}
              </dd>
              {value && (
                <Check
                  role="img"
                  aria-label="Đã có thông tin"
                  className="size-4 shrink-0 text-primary"
                />
              )}
            </div>
          ))}
        </dl>
      </CheckoutCell>
      <CheckoutCell
        title="Phương thức VNPay"
        note="Chọn tại cổng VNPay"
        className="order-4"
      >
        <ul className={checkoutGroup}>
          {METHODS.map(({ name, hint, Icon }) => (
            <li key={name} className={row}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-gateway-soft text-gateway">
                <Icon aria-hidden="true" className="size-4.5" />
              </span>
              <span className="flex-1 font-semibold whitespace-nowrap">
                {name}
              </span>
              <span className="text-right text-[13px] text-muted-foreground">
                {hint}
              </span>
            </li>
          ))}
        </ul>
      </CheckoutCell>
      <CheckoutCell title="Mã giảm giá" className="order-5">
        <div className="flex h-13 items-center gap-2 rounded-xl border border-input pr-1.5 pl-4 focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-ring short:h-11.5">
          <input
            aria-label="Mã giảm giá"
            placeholder="Nhập mã"
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
            value={voucher}
            onChange={(e) => setVoucher(e.target.value)}
            disabled={disabled}
          />
          <Button
            variant="secondary"
            className="h-10 rounded-lg px-4 font-semibold short:h-8.5"
            disabled={disabled}
            onClick={() =>
              setMessage(
                voucher.trim()
                  ? "Chưa hỗ trợ áp dụng mã giảm giá cho đơn này."
                  : "Vui lòng nhập mã giảm giá.",
              )
            }
          >
            Kiểm tra
          </Button>
        </div>
        <p
          role="status"
          className="text-sm text-muted-foreground [&:not(:empty)]:mt-2"
        >
          {message || (voucherCode ? `Mã đã áp dụng: ${voucherCode}` : null)}
        </p>
      </CheckoutCell>
      <CheckoutCell className="order-8 justify-end">
        {error}
        <Button
          ref={payButtonRef}
          className="h-15 w-full rounded-xl bg-primary-strong text-base font-bold hover:bg-primary-strong/90 short:h-13"
          disabled={payDisabled}
          onClick={onPay}
        >
          {paying ? "Đang chuyển tới VNPay..." : "Thanh toán ngay qua VNPay"}
        </Button>
      </CheckoutCell>
    </section>
  );
}
