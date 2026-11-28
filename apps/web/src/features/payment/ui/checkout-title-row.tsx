import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import {
  formatTimer,
  holdTone,
  HOLD_SECONDS,
  type HoldTone,
} from "../domain/order-checkout";

const TONE: Record<HoldTone, { time: string; ring: string }> = {
  calm: { time: "text-foreground", ring: "var(--primary)" },
  soon: { time: "text-warning", ring: "var(--warning-ring)" },
  urgent: { time: "text-destructive", ring: "var(--destructive)" },
};
// Khoét giữa hình tròn để thành vòng tiến độ.
const RING_MASK = "radial-gradient(circle, transparent 5.5px, black 6px)";

/** Hàng tiêu đề dính trên đầu: đồng hồ giữ chỗ và nút hủy chung một khối. */
export function CheckoutTitleRow({
  seconds,
  cancelDisabled,
  cancelling,
  onCancel,
}: {
  seconds: number | null;
  cancelDisabled: boolean;
  cancelling: boolean;
  onCancel: () => void;
}) {
  const tone = holdTone(seconds ?? HOLD_SECONDS);
  const percent = ((seconds ?? HOLD_SECONDS) / HOLD_SECONDS) * 100;
  return (
    <div className="sticky top-0 z-30 mb-2 flex items-center justify-between gap-4 bg-checkout-page py-2 lg:mb-4">
      <h1 className="text-[28px] font-semibold tracking-tight max-lg:sr-only">
        Thanh toán
      </h1>
      <div
        data-testid="hold-capsule"
        className="flex items-center justify-between gap-4 rounded-full bg-background py-1.5 pr-1.5 pl-4 shadow-sheet max-lg:w-full max-[359px]:gap-2"
      >
        <p className="flex items-center gap-2 whitespace-nowrap">
          <span
            aria-hidden="true"
            className="size-5 rounded-full"
            style={{
              background: `conic-gradient(${TONE[tone].ring} ${percent}%, var(--border) 0)`,
              mask: RING_MASK,
            }}
          />
          <span className="text-[13px] text-muted-foreground max-[359px]:sr-only">
            Giữ chỗ
          </span>
          <strong
            role="timer"
            aria-label="Thời gian giữ chỗ"
            className={cn(
              "text-[17px] font-semibold tabular-nums",
              TONE[tone].time,
            )}
          >
            {seconds === null ? "--:--" : formatTimer(seconds)}
          </strong>
        </p>
        <Button
          variant="secondary"
          disabled={cancelDisabled}
          onClick={onCancel}
          className="max-[359px]:px-4"
        >
          {cancelling ? "Đang hủy..." : "Hủy giao dịch"}
        </Button>
      </div>
      {seconds !== null && tone === "urgent" && (
        // Màu đồng hồ đã báo bằng mắt; câu này chỉ dành cho trình đọc màn hình.
        <p role="alert" className="sr-only">
          Phiên giữ chỗ sắp hết hạn. Bạn cần còn hơn 45 giây để sang VNPay.
        </p>
      )}
    </div>
  );
}
