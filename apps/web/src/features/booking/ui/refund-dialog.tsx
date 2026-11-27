"use client";

import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { money, refundPolicyLabel } from "@/features/payment";
import { Dialog, DialogContent } from "@/shared/ui/dialog";
import { FlowError } from "@/shared/ui/flow-shell";
import type { Refund } from "./use-refund";

/** Xem truoc so tien hoan, nhap ly do va xac nhan huy ve. */
export function RefundDialog({ refund }: { refund: Refund }) {
  const { preview, uncertain, busy } = refund;
  return (
    <Dialog
      open={preview !== null}
      onOpenChange={(open) => {
        if (!open) refund.closePreview();
      }}
    >
      {preview && (
        <DialogContent
          showCloseButton={false}
          className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto rounded-3xl p-6 text-[15px] sm:max-w-md"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogPrimitive.Title className="text-[17px] font-semibold">
                Hoàn vé
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-[13px] text-muted-foreground">
                Chính sách {refundPolicyLabel[preview.policyType]}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              aria-label="Đóng"
              disabled={refund.submitting || uncertain}
              className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-fill hover:bg-fill-hover disabled:cursor-default disabled:opacity-40"
            >
              <X aria-hidden="true" className="size-5" />
            </DialogPrimitive.Close>
          </div>
          <p>Tỷ lệ hoàn: {preview.refundPercentage}%</p>
          <ul className="space-y-2">
            {preview.items.map((item) => (
              <li key={item.ticketId}>
                <p>{item.seatLabel}</p>
                <p className="text-[13px] text-muted-foreground">
                  Hoàn {money(item.refundAmount)} · Khấu trừ{" "}
                  {money(item.feeDeducted)}
                </p>
              </li>
            ))}
          </ul>
          <div className="border-t border-border pt-4">
            <p className="text-[13px] text-muted-foreground">
              Phí khấu trừ: {money(preview.totalFeeDeducted)}
            </p>
            <p className="text-[17px] font-semibold">
              Tổng tiền hoàn: {money(preview.totalRefundAmount)}
            </p>
          </div>
          {preview.totalRefundAmount === 0 && (
            <p>
              Vé đã chọn không đủ điều kiện hoàn tiền theo chính sách hiện tại.
            </p>
          )}
          <label className="block">
            Lý do hủy
            <textarea
              className="mt-2 w-full rounded-2xl border border-input bg-background p-4"
              maxLength={500}
              value={refund.reason}
              disabled={busy}
              onChange={(e) => refund.setReason(e.target.value)}
            />
          </label>
          <p className="text-[13px] text-muted-foreground">
            Xác nhận sẽ thu hồi các vé đã chọn. Các vé còn lại vẫn có hiệu lực.
          </p>
          {refund.submitError && <FlowError error={refund.submitError} />}
          {uncertain && (
            <p role="alert" className="text-warning">
              Chưa xác nhận được kết quả. Gửi lại cùng yêu cầu để tránh tạo yêu
              cầu hoàn tiền trùng.
            </p>
          )}
          <button
            type="button"
            className="h-14 cursor-pointer rounded-full bg-primary text-[17px] font-semibold text-primary-foreground hover:bg-primary-strong disabled:cursor-default disabled:opacity-40"
            disabled={
              refund.submitting ||
              !refund.reason.trim() ||
              preview.totalRefundAmount <= 0
            }
            onClick={refund.confirm}
          >
            {refund.submitting
              ? "Đang gửi yêu cầu..."
              : uncertain
                ? "Gửi lại cùng yêu cầu"
                : "Xác nhận hủy vé"}
          </button>
        </DialogContent>
      )}
    </Dialog>
  );
}
