import { useState, type ReactNode, type Ref } from "react";
import { CreditCard, Landmark, QrCode, Tag } from "lucide-react";
import { useSession } from "@/features/identity";
import { Button } from "@/shared/ui/button";
import { CheckoutCell } from "./checkout-cell";

/** Nửa phải: người nhận, cổng thanh toán, mã giảm giá và nút thanh toán. */
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
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [voucher, setVoucher] = useState("");
  const [message, setMessage] = useState("");
  return (
    <section
      aria-label="Thông tin thanh toán"
      className="contents border-border lg:row-span-3 lg:grid lg:grid-rows-subgrid lg:border-l"
    >
      <CheckoutCell title="Vé gửi đến" className="order-3">
        <p className="mb-1 text-base font-bold break-words">
          {user?.fullName || "Chưa cập nhật"}
        </p>
        <p className="break-all text-muted-foreground">
          {user?.email || "Chưa cập nhật"}
        </p>
      </CheckoutCell>
      <CheckoutCell title="Thanh toán qua VNPay" className="order-4">
        <div className="flex items-center gap-4 max-[399px]:flex-col max-[399px]:items-start max-[399px]:gap-3">
          {/* Chỉ để tham khảo: người mua chọn phương thức tại cổng VNPay. */}
          <div aria-hidden="true" className="flex gap-2">
            {[QrCode, Landmark, CreditCard].map((Icon, index) => (
              <span
                key={index}
                className="flex size-11 items-center justify-center rounded-lg bg-gateway-soft text-gateway"
              >
                <Icon className="size-4.5" />
              </span>
            ))}
          </div>
          <div>
            <p className="font-semibold">QR, thẻ ATM, Visa, Mastercard</p>
            <p className="text-[13px] text-muted-foreground">
              Chọn tại cổng VNPay
            </p>
          </div>
        </div>
        {voucherOpen ? (
          <div className="mt-4 flex h-12 items-center gap-2 rounded-xl border border-input pr-1 pl-4 focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-ring short:mt-2 short:h-11">
            <input
              aria-label="Mã giảm giá"
              placeholder="Nhập mã giảm giá"
              // Ô chỉ xuất hiện khi người mua vừa bấm mở.
              autoFocus
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
              value={voucher}
              onChange={(e) => setVoucher(e.target.value)}
              disabled={disabled}
            />
            <Button
              variant="secondary"
              className="h-9.5 rounded-lg px-4 font-semibold"
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
        ) : (
          <Button
            variant="link"
            className="mt-4 h-9 gap-2 self-start px-0 font-semibold text-primary-strong short:mt-1"
            disabled={disabled}
            onClick={() => setVoucherOpen(true)}
          >
            <Tag aria-hidden="true" className="size-4" />
            Thêm mã giảm giá
          </Button>
        )}
        <p
          role="status"
          className="text-sm text-muted-foreground [&:not(:empty)]:mt-2"
        >
          {message || (voucherCode ? `Mã đã áp dụng: ${voucherCode}` : null)}
        </p>
      </CheckoutCell>
      <CheckoutCell className="order-6 justify-end">
        {error}
        <Button
          ref={payButtonRef}
          className="h-14 w-full rounded-xl bg-primary-strong text-base font-bold hover:bg-primary-strong/90 short:h-12"
          disabled={payDisabled}
          onClick={onPay}
        >
          {paying ? "Đang chuyển tới VNPay..." : "Thanh toán ngay qua VNPay"}
        </Button>
      </CheckoutCell>
    </section>
  );
}
