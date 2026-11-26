"use client";

import { Check, ArrowRight, ArrowLeft } from "lucide-react";
import type { CreateEventWizard } from "./use-create-event-wizard";

/** Khoi giao dien: wizard-step-2. */
export function WizardStep2({ vm }: { vm: CreateEventWizard }) {
  const {
    step,
    setStep,
    selectedLayoutKey,
    handleSelectLayout,
    selectedVenue,
    availableLayouts,
    handleProceedToStep3,
  } = vm;

  return (
    <>
      {step === 2 && selectedVenue && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Chọn mẫu sơ đồ chỗ ngồi
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Địa điểm:{" "}
                <strong className="text-foreground">
                  {selectedVenue.name}
                </strong>{" "}
                • {selectedVenue.city}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-semibold cursor-pointer"
            >
              <ArrowLeft className="size-3.5" />
              <span>Quay lại thông tin sự kiện</span>
            </button>
          </div>

          {/* Layout Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableLayouts.map((layout) => {
              const isSelected = selectedLayoutKey === layout.mapKey;

              return (
                <div
                  key={layout.id}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onClick={() => handleSelectLayout(layout.mapKey)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectLayout(layout.mapKey);
                    }
                  }}
                  className={`p-4 rounded-lg border bg-background transition-all text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring relative ${
                    isSelected
                      ? "border-primary ring-2 ring-primary/20 bg-accent/20"
                      : "border-border hover:border-foreground/40"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-3 right-3 size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Check className="size-3" />
                    </div>
                  )}

                  <div className="space-y-2">
                    <div>
                      <span className="text-[11px] font-semibold text-primary">
                        {layout.categoryName}
                      </span>
                      <h3 className="text-base font-bold text-foreground mt-0.5">
                        {layout.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {layout.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        Sức chứa ước tính:{" "}
                        <strong className="text-foreground font-semibold">
                          {layout.capacityEstimate}
                        </strong>
                      </span>
                      <span>{layout.defaultZones.length} phân khu giá</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md border border-border bg-background hover:bg-secondary text-foreground text-sm font-medium transition-colors cursor-pointer"
            >
              <ArrowLeft className="size-4" />
              <span>Quay lại</span>
            </button>

            <button
              type="button"
              onClick={handleProceedToStep3}
              className="inline-flex items-center gap-1.5 h-10 px-5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>Tiếp tục: Cấu hình hạng vé</span>
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
