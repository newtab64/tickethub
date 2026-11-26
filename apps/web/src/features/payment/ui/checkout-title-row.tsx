import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import {
  formatTimer,
  holdTone,
  HOLD_SECONDS,
  type HoldTone,
} from "../domain/order-checkout";

const TONE: Record<HoldTone, { box: string; ring: string }> = {
  calm: {
    box: "border-border bg-background text-muted-foreground [&_strong]:text-foreground",
    ring: "var(--primary)",
  },
  soon: {
    box: "border-warning-border bg-warning-soft text-warning",
    ring: "var(--warning-ring)",
  },
  urgent: {
    box: "border-destructive/40 bg-background text-destructive",
    ring: "var(--destructive)",
  },
};
// Khoét giữa hình tròn để thành vòng tiến độ.
const RING_MASK = "radial-gradient(circle, transparent 5.5px, black 6px)";

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
    <div className="sticky top-0 z-30 mb-1 grid grid-cols-[1fr_auto_auto] items-center gap-2 bg-checkout-page py-2.5 lg:mb-6 lg:grid-cols-[1fr_auto_1fr] lg:py-0 short:mb-3">
      <h1 className="text-[22px] font-bold tracking-tight whitespace-nowrap max-[359px]:text-lg lg:text-[28px]">
        Thanh toán
      </h1>
      <div
        className={cn(
          "flex h-11 items-center gap-2.5 rounded-full border pr-5 pl-3.5 text-[13px] shadow-sm max-[359px]:gap-2 max-[359px]:pr-3 max-[359px]:pl-2.5",
          TONE[tone].box,
        )}
      >
        <span
          aria-hidden="true"
          className="size-5 rounded-full"
          style={{
            background: `conic-gradient(${TONE[tone].ring} ${percent}%, var(--border) 0)`,
            mask: RING_MASK,
          }}
        />
        <span className="hidden lg:inline">Giữ chỗ còn</span>
        <strong
          role="timer"
          aria-label="Thời gian giữ chỗ"
          className="text-lg font-bold tabular-nums"
        >
          {seconds === null ? "--:--" : formatTimer(seconds)}
        </strong>
      </div>
      <Button
        variant="outline"
        aria-label="Hủy giao dịch"
        className="h-11 justify-self-end rounded-full bg-background px-4 font-semibold text-destructive shadow-sm hover:text-destructive max-[359px]:px-3"
        disabled={cancelDisabled}
        onClick={onCancel}
      >
        {cancelling ? (
          "Đang hủy..."
        ) : (
          <span>
            Hủy<span className="hidden lg:inline"> giao dịch</span>
          </span>
        )}
      </Button>
      {seconds !== null && tone === "urgent" && (
        <p
          role="alert"
          className="col-span-full justify-self-center rounded-2xl bg-background px-3 py-1 text-center text-sm text-destructive"
        >
          Phiên giữ chỗ sắp hết hạn. Bạn cần còn hơn 45 giây để sang VNPay.
        </p>
      )}
    </div>
  );
}
