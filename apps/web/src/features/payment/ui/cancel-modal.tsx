"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/shared/ui/button";
import type { CheckoutScreen } from "./use-checkout-screen";

/** Xac nhan huy giao dich. */
export function CancelModal({ vm }: { vm: CheckoutScreen }) {
  const { setShowCancelModal, isCancelling, confirmCancelHold } = vm;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl">
        <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <h3 className="text-lg font-bold text-foreground">
          Xác nhận hủy giữ chỗ?
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Vé của bạn sẽ được hoàn trả về kho vé ngay lập tức để người khác có
          thể đặt mua. Bạn có chắc chắn muốn hủy giao dịch này không?
        </p>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={isCancelling}
            onClick={() => setShowCancelModal(false)}
            className="h-10 text-xs sm:text-sm font-semibold"
          >
            Tiếp tục đặt vé
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isCancelling}
            onClick={confirmCancelHold}
            className="h-10 text-xs sm:text-sm font-bold bg-destructive text-white hover:bg-destructive/90"
          >
            {isCancelling ? "Đang hủy..." : "Hủy giữ chỗ"}
          </Button>
        </div>
      </div>
    </div>
  );
}
