"use client";

import { Check } from "lucide-react";
import type { CreateEventWizard } from "./use-create-event-wizard";

/** Khoi giao dien: wizard-header. */
export function WizardHeader({ vm }: { vm: CreateEventWizard }) {
  const { step, savedAtTime, isSavingDraft, handleStepClick } = vm;

  return (
    <>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Tạo sự kiện
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Thiết lập địa điểm, sơ đồ chỗ ngồi và cấu hình giá vé cho sự kiện
              mới.
            </p>
          </div>

          {/* Draft Autosave Indicator */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground self-start sm:self-auto">
            {isSavingDraft ? (
              <span className="flex items-center gap-1.5 font-medium">
                <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                Đang lưu nháp...
              </span>
            ) : savedAtTime ? (
              <span className="flex items-center gap-1.5 text-foreground font-medium">
                <Check className="size-3.5 text-primary" />
                Đã lưu nháp lúc {savedAtTime}
              </span>
            ) : (
              <span>Chưa lưu nháp</span>
            )}
          </div>
        </div>

        {/* Stepper: Compact cards, readable contrast (>= 4.5:1) while muted */}
        <nav aria-label="Các bước thiết lập sự kiện" className="w-full">
          <ol className="grid grid-cols-4 gap-2 sm:gap-3">
            {[
              { num: 1, title: "Thông tin & Địa điểm" },
              { num: 2, title: "Sơ đồ chỗ ngồi" },
              { num: 3, title: "Hạng vé & Giá bán" },
              { num: 4, title: "Xem trước & Xuất bản" },
            ].map((s) => {
              const isCompleted = s.num < step;
              const isCurrent = s.num === step;
              const isFuture = s.num > step;

              return (
                <li key={s.num} className="relative">
                  <button
                    type="button"
                    disabled={isFuture}
                    onClick={() => handleStepClick(s.num as 1 | 2 | 3 | 4)}
                    className={`w-full text-left p-2 sm:p-2.5 rounded-lg border transition-all ${
                      isCurrent
                        ? "border-primary bg-background shadow-2xs"
                        : isCompleted
                          ? "border-border bg-background hover:bg-secondary/40 cursor-pointer"
                          : "border-border/80 bg-secondary/30 text-foreground cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-2.5">
                      <div
                        className={`size-6 sm:size-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          isCompleted
                            ? "bg-primary text-primary-foreground"
                            : isCurrent
                              ? "border-2 border-primary text-primary bg-background"
                              : "bg-secondary text-foreground border border-border"
                        }`}
                      >
                        {isCompleted ? <Check className="size-3.5" /> : s.num}
                      </div>
                      <div className="min-w-0 flex-1 hidden sm:block">
                        <p className="text-[10px] text-muted-foreground leading-tight font-medium">
                          Bước {s.num}
                        </p>
                        <p
                          className={`text-xs truncate ${
                            isCurrent
                              ? "font-bold text-foreground"
                              : isCompleted
                                ? "font-medium text-foreground"
                                : "font-medium text-foreground/80"
                          }`}
                        >
                          {s.title}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    </>
  );
}
