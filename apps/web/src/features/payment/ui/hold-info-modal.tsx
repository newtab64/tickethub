"use client";

import { Clock, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import type { CheckoutScreen } from "./use-checkout-screen";

/** Giai thich ve thoi gian giu cho. */
export function HoldInfoModal({ vm }: { vm: CheckoutScreen }) {
  const { setShowInfoModal } = vm;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl max-w-sm w-full p-5 text-foreground space-y-3 shadow-xl">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <span>Quy định giữ chỗ 5 phút</span>
          </h3>
          <button
            type="button"
            onClick={() => setShowInfoModal(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Nhằm đảm bảo sự công bằng cho tất cả người mua, vé của bạn sẽ được hệ
          thống tạm khóa và giữ trong đúng 5 phút (300 giây). Nếu quá hạn trên,
          vé sẽ tự động được trả lại kho vé chung.
        </p>
        <Button
          type="button"
          onClick={() => setShowInfoModal(false)}
          className="w-full h-9 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Đã hiểu
        </Button>
      </div>
    </div>
  );
}
