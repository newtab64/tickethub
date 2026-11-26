"use client";

import { Info } from "lucide-react";
import { formatDateTimeVi } from "@/shared/lib/format-vi";
import { clearSavedEventDraft } from "../api/draft-storage";
import type { CreateEventWizard } from "./use-create-event-wizard";

/** Khoi giao dien: wizard-draft-banner. */
export function WizardDraftBanner({ vm }: { vm: CreateEventWizard }) {
  const {
    hasDraftBanner,
    setHasDraftBanner,
    pendingDraft,
    handleRestoreDraft,
  } = vm;

  return (
    <>
      {hasDraftBanner && pendingDraft && (
        <div
          role="region"
          aria-label="Thông báo bản nháp"
          className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-background text-xs text-foreground shadow-2xs"
        >
          <div className="flex items-center gap-2.5">
            <Info className="size-4 text-primary shrink-0" />
            <p>
              Bạn có một bản nháp chưa hoàn tất:{" "}
              <strong className="font-semibold text-foreground">
                &quot;{pendingDraft.title || "Sự kiện chưa đặt tên"}&quot;
              </strong>{" "}
              được lưu lúc {formatDateTimeVi(pendingDraft.savedAt)}.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRestoreDraft}
              className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Khôi phục bản nháp
            </button>
            <button
              type="button"
              onClick={() => {
                setHasDraftBanner(false);
                clearSavedEventDraft();
              }}
              className="h-7 px-2.5 rounded-md border border-border text-muted-foreground hover:text-foreground text-xs transition-colors cursor-pointer"
            >
              Bỏ qua
            </button>
          </div>
        </div>
      )}
    </>
  );
}
