"use client";

import { Suspense } from "react";

import { WizardDraftBanner } from "./wizard-draft-banner";
import { WizardHeader } from "./wizard-header";
import { WizardStep1 } from "./wizard-step-1";
import { WizardStep2 } from "./wizard-step-2";
import { WizardStep3 } from "./wizard-step-3";
import { WizardStep4 } from "./wizard-step-4";
import { WizardMobileActionBar } from "./wizard-mobile-action-bar";
import { useCreateEventWizard } from "./use-create-event-wizard";

function CreateEventWizardContent() {
  const vm = useCreateEventWizard();

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      <WizardDraftBanner vm={vm} />
      <WizardHeader vm={vm} />
      <WizardStep1 vm={vm} />
      <WizardStep2 vm={vm} />
      <WizardStep3 vm={vm} />
      <WizardStep4 vm={vm} />
      <WizardMobileActionBar vm={vm} />
    </div>
  );
}

export function CreateEventWizardPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[1200px] mx-auto px-4 py-8 text-xs text-muted-foreground">
          Đang tải trang tạo sự kiện...
        </div>
      }
    >
      <CreateEventWizardContent />
    </Suspense>
  );
}
