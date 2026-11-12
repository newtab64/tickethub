"use client";

import { Clock } from "lucide-react";
import { Button } from "@/shared/ui/button";
import type { CheckoutScreen } from "./use-checkout-screen";

/** Thong bao het han giu cho. */
export function ExpiredModal({ vm }: { vm: CheckoutScreen }) {
  const { router } = vm;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl">
        <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <Clock className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-foreground">
          Hết thời gian giữ chỗ (05:00)
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Thời hạn giữ vé 5 phút đã kết thúc. Hệ thống đã tự động giải phóng vị
          trí ghế này để bảo đảm công bằng cho các khách hàng khác.
        </p>
        <div className="pt-2">
          <Button
            type="button"
            onClick={() => router.push("/events")}
            className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
          >
            Quay về trang sự kiện
          </Button>
        </div>
      </div>
    </div>
  );
}
