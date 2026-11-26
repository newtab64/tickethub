"use client";

import { ArrowRight, ArrowLeft } from "lucide-react";
import { SeatMap } from "@/features/event";
import {
  formatVndCurrency as formatVnd,
  formatNumberVi,
} from "@/shared/lib/format-vi";
import type { CreateEventWizard } from "./use-create-event-wizard";

/** Khoi giao dien: wizard-step-3. */
export function WizardStep3({ vm }: { vm: CreateEventWizard }) {
  const {
    step,
    setStep,
    selectedLayoutKey,
    zones,
    hoveredZoneId,
    setHoveredZoneId,
    currentLayoutTemplate,
    handleZonePriceChange,
    handleZoneCapacityChange,
    handleProceedToStep4,
    totalEventCapacity,
    totalProjectedRevenue,
  } = vm;

  return (
    <>
      {step === 3 && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Cấu hình phân khu &amp; đơn giá
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Thiết lập mức giá và số lượng vé cho từng khán đài. Rê chuột lên
                sơ đồ hoặc bảng để đối soát.
              </p>
            </div>
            <div className="text-xs text-muted-foreground">
              Sơ đồ:{" "}
              <strong className="text-foreground">
                {currentLayoutTemplate.name}
              </strong>
            </div>
          </div>

          {/* Split-View Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Interactive SeatMap */}
            <div className="lg:col-span-6 rounded-lg border border-border bg-background p-4 space-y-3 lg:sticky lg:top-20">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  Sơ đồ chỗ ngồi tương tác
                </span>
                <span>Di chuột để xem vị trí</span>
              </div>

              <div className="relative aspect-[4/3] w-full rounded-md border border-border/60 bg-muted/20 overflow-hidden flex items-center justify-center">
                <SeatMap
                  mapKey={selectedLayoutKey}
                  hoveredZoneId={hoveredZoneId}
                  onSelectZone={() => {}}
                  onHoverZone={(zoneId: string | null) =>
                    setHoveredZoneId(zoneId)
                  }
                  zoneInfoMap={zones.reduce<
                    Record<
                      string,
                      { name: string; minPrice: number; count: number }
                    >
                  >((acc, z) => {
                    acc[z.zoneId] = {
                      name: z.name,
                      minPrice: z.price,
                      count: z.capacity,
                    };
                    return acc;
                  }, {})}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                <span>Trạng thái: Khán đài đã tối ưu tỷ lệ</span>
                <span className="tabular-nums font-medium text-foreground">
                  {zones.length} khu vực hoạt động
                </span>
              </div>
            </div>

            {/* Right: Zone Config Table (No monospace; base UI font with tabular-nums) */}
            <div className="lg:col-span-6 space-y-3">
              <div className="rounded-lg border border-border bg-background overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                      <th className="py-2.5 px-3">Phân khu</th>
                      <th className="py-2.5 px-3 w-36">Đơn giá (VNĐ)</th>
                      <th className="py-2.5 px-3 w-28 text-right">Số lượng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {zones.map((zone) => {
                      const isHovered = hoveredZoneId === zone.zoneId;

                      return (
                        <tr
                          key={zone.zoneId}
                          onMouseEnter={() => setHoveredZoneId(zone.zoneId)}
                          onMouseLeave={() => setHoveredZoneId(null)}
                          className={`transition-colors ${
                            isHovered
                              ? "bg-accent/40 font-semibold"
                              : "hover:bg-secondary/40"
                          }`}
                        >
                          <td className="py-3 px-3">
                            <div className="space-y-0.5">
                              <span className="font-bold text-foreground">
                                {zone.name}
                              </span>
                              <p className="text-[11px] text-muted-foreground">
                                Mã phân khu: {zone.zoneId} •{" "}
                                {zone.isSeated ? "Ghế ngồi có số" : "Khu đứng"}
                              </p>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <input
                              type="number"
                              min={0}
                              step={50000}
                              value={zone.price}
                              onChange={(e) =>
                                handleZonePriceChange(
                                  zone.zoneId,
                                  parseInt(e.target.value, 10) || 0,
                                )
                              }
                              className="w-full h-8 px-2.5 rounded-md border border-input bg-background text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring tabular-nums"
                            />
                            <span className="text-[10.5px] text-muted-foreground tabular-nums block mt-0.5">
                              {formatVnd(zone.price)}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-right">
                            <input
                              type="number"
                              min={10}
                              step={50}
                              value={zone.capacity}
                              onChange={(e) =>
                                handleZoneCapacityChange(
                                  zone.zoneId,
                                  parseInt(e.target.value, 10) || 10,
                                )
                              }
                              className="w-24 h-8 px-2.5 rounded-md border border-input bg-background text-xs text-right text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring tabular-nums inline-block"
                            />
                            <span className="text-[10.5px] text-muted-foreground tabular-nums block mt-0.5">
                              vé
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Financial Summary (Base UI font, tabular-nums) */}
              <div className="p-3.5 rounded-lg border border-border bg-background flex items-center justify-between text-xs">
                <div>
                  <span className="text-muted-foreground">
                    Tổng số vé phát hành:
                  </span>{" "}
                  <strong className="text-foreground tabular-nums font-semibold">
                    {formatNumberVi(totalEventCapacity)}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    Doanh thu dự kiến:
                  </span>{" "}
                  <strong className="text-foreground tabular-nums font-bold">
                    {formatVnd(totalProjectedRevenue)}
                  </strong>
                </div>
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md border border-border bg-background hover:bg-secondary text-foreground text-sm font-medium transition-colors cursor-pointer"
                >
                  <ArrowLeft className="size-4" />
                  <span>Quay lại</span>
                </button>

                <button
                  type="button"
                  onClick={handleProceedToStep4}
                  className="inline-flex items-center gap-1.5 h-10 px-5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span>Tiếp tục: Xem trước sự kiện</span>
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
