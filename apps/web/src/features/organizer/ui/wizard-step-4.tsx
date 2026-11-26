"use client";

import { Check, CheckCircle2, ArrowLeft } from "lucide-react";
import {
  formatVndCurrency as formatVnd,
  formatDateTimeVi,
  formatNumberVi,
} from "@/shared/lib/format-vi";
import type { CreateEventWizard } from "./use-create-event-wizard";

/** Khoi giao dien: wizard-step-4. */
export function WizardStep4({ vm }: { vm: CreateEventWizard }) {
  const {
    step,
    setStep,
    title,
    category,
    startDate,
    startTime,
    endDate,
    endTime,
    zones,
    isPublished,
    selectedVenue,
    currentLayoutTemplate,
    handleFinalPublish,
    totalEventCapacity,
    totalProjectedRevenue,
  } = vm;

  return (
    <>
      {step === 4 && selectedVenue && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold text-foreground">
              Xem trước và xuất bản sự kiện
            </h2>
            <p className="text-xs text-muted-foreground">
              Vui lòng rà soát lại thông tin trước khi phát hành sự kiện lên
              tickethub.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-background p-6 space-y-5 shadow-2xs">
            {/* Header info */}
            <div className="space-y-1 pb-4 border-b border-border">
              <span className="text-xs font-semibold text-primary">
                {category}
              </span>
              <h3 className="text-lg font-bold text-foreground">{title}</h3>
              <p className="text-xs text-muted-foreground tabular-nums">
                Thời gian: {formatDateTimeVi(`${startDate}T${startTime}`)}
                {endDate &&
                  endTime &&
                  ` - ${formatDateTimeVi(`${endDate}T${endTime}`)}`}
              </p>
            </div>

            {/* Venue & Layout */}
            <div className="grid grid-cols-2 gap-4 text-xs pb-4 border-b border-border">
              <div>
                <span className="text-muted-foreground block text-[11px]">
                  Địa điểm
                </span>
                <strong className="text-foreground text-xs">
                  {selectedVenue.name}
                </strong>
                <p className="text-muted-foreground text-[11.5px] mt-0.5">
                  {selectedVenue.address}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">
                  Sơ đồ chỗ ngồi
                </span>
                <strong className="text-foreground text-xs">
                  {currentLayoutTemplate.name}
                </strong>
                <p className="text-muted-foreground text-[11.5px] mt-0.5">
                  {currentLayoutTemplate.categoryName}
                </p>
              </div>
            </div>

            {/* Ticket Breakdown (Base UI font, tabular-nums) */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-foreground">
                Cấu hình các phân khu vé
              </span>
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                      <th className="py-2 px-3">Hạng vé</th>
                      <th className="py-2 px-3 text-right">Đơn giá</th>
                      <th className="py-2 px-3 text-right">Số lượng</th>
                      <th className="py-2 px-3 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {zones.map((z) => (
                      <tr key={z.zoneId} className="hover:bg-secondary/40">
                        <td className="py-2 px-3 font-medium text-foreground">
                          {z.name}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-medium">
                          {formatVnd(z.price)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-medium">
                          {formatNumberVi(z.capacity)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-semibold text-foreground">
                          {formatVnd(z.capacity * z.price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-muted/30 font-bold text-foreground">
                      <td className="py-2.5 px-3">Tổng cộng</td>
                      <td className="py-2.5 px-3" />
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        {formatNumberVi(totalEventCapacity)} vé
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-primary font-bold">
                        {formatVnd(totalProjectedRevenue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md border border-border bg-background hover:bg-secondary text-foreground text-sm font-medium transition-colors cursor-pointer"
              >
                <ArrowLeft className="size-4" />
                <span>Quay lại cấu hình</span>
              </button>

              <button
                type="button"
                onClick={handleFinalPublish}
                disabled={isPublished}
                className="inline-flex items-center gap-2 h-10 px-6 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold transition-colors shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {isPublished ? (
                  <>
                    <Check className="size-4" />
                    <span>Đang phát hành...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" />
                    <span>Xuất bản sự kiện</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
