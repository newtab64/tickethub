import { useState, type ReactNode, type Ref } from "react";
import { useSession } from "@/features/identity";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

const LABEL = "text-[13px] text-muted-foreground";

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
      className="contents lg:flex lg:min-w-0 lg:flex-col lg:border-l lg:border-border lg:p-8 short:lg:p-6"
    >
      <div className="order-3 px-5 lg:p-0">
        <div className="border-t border-border py-4 lg:border-t-0 lg:pt-0">
          <h2 className={LABEL}>Vé gửi đến</h2>
          <p className="text-[17px] font-semibold break-words">
            {user?.fullName || "Chưa cập nhật"}
          </p>
          <p className="text-[13px] break-all text-muted-foreground">
            {user?.email || "Chưa cập nhật"}
          </p>
        </div>
      </div>
      <div className="order-4 px-5 lg:p-0">
        {/* Chỉ để tham khảo: người mua chọn phương thức tại cổng VNPay. */}
        <div className="border-t border-border py-4">
          <h2 className={LABEL}>Thanh toán qua VNPay</h2>
          <p>QR, thẻ ATM, Visa, Mastercard</p>
          <p className="text-[13px] text-muted-foreground">
            Bạn chọn cách trả ở bước tiếp theo.
          </p>
        </div>
        <div className="border-t border-border pt-2">
          {voucherOpen ? (
            <div className="flex items-center gap-2 pt-2">
              <Input
                aria-label="Mã giảm giá"
                placeholder="Nhập mã giảm giá"
                // Ô chỉ xuất hiện khi người mua vừa bấm mở.
                autoFocus
                value={voucher}
                onChange={(e) => setVoucher(e.target.value)}
                disabled={disabled}
              />
              <Button
                variant="secondary"
                size="lg"
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
            <button
              type="button"
              className="min-h-11 cursor-pointer font-semibold underline underline-offset-4 disabled:cursor-default disabled:opacity-50"
              disabled={disabled}
              onClick={() => setVoucherOpen(true)}
            >
              Thêm mã giảm giá
            </button>
          )}
          <p
            role="status"
            className="px-5 text-[13px] text-muted-foreground [&:not(:empty)]:mt-2"
          >
            {message || (voucherCode ? `Mã đã áp dụng: ${voucherCode}` : null)}
          </p>
        </div>
      </div>
      <div className="order-6 px-5 pb-6 lg:mt-auto lg:p-0 lg:pt-6">
        {error}
        <Button
          ref={payButtonRef}
          size="lg"
          className="w-full"
          disabled={payDisabled}
          onClick={onPay}
        >
          {paying ? "Đang chuyển tới VNPay..." : "Thanh toán ngay qua VNPay"}
        </Button>
      </div>
    </section>
  );
}
