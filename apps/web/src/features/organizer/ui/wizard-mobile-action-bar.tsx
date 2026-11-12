"use client";

import { ArrowRight } from "lucide-react";
import type { CreateEventWizard } from "./use-create-event-wizard";

/** Khoi giao dien: wizard-mobile-action-bar. */
export function WizardMobileActionBar({ vm }: { vm: CreateEventWizard }) {
  const { step, isValidStep1, step1HelperMessage, handleProceedToStep2 } = vm;

  return (
    <>
      {step === 1 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 p-3.5 border-t border-border bg-background/95 backdrop-blur-xs shadow-lg space-y-1.5">
          <button
            type="button"
            disabled={!isValidStep1}
            onClick={handleProceedToStep2}
            className="w-full h-11 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Tiếp tục: Chọn sơ đồ chỗ ngồi</span>
            <ArrowRight className="size-4" />
          </button>
          {!isValidStep1 && (
            <p className="text-[11px] text-muted-foreground text-center truncate">
              {step1HelperMessage}
            </p>
          )}
        </div>
      )}
    </>
  );
}
