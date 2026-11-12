"use client";

import { Suspense } from "react";
import { useAuthFlow } from "./use-auth-flow";
import { AuthStageSizer } from "./auth-stage-sizer";
import { IdentifierStep } from "./identifier-step";
import { PasswordStep } from "./password-step";
import { RegisterStep } from "./register-step";

function AuthFlowContent() {
  const flow = useAuthFlow();
  const { activeStep, announcement } = flow;

  return (
    <div
      data-slot="auth-stage form-wrapper"
      className="stage w-full max-w-[440px] mx-auto my-auto grid grid-cols-1 [grid-template-rows:1fr] items-start [transform:translateY(var(--auth-stage-offset,-3vh))] motion-reduce:transform-none"
    >
      {/* Screen-reader Live Region */}
      <div aria-live="polite" className="sr-only" role="status">
        {announcement}
      </div>

      <AuthStageSizer flow={flow} />

      {activeStep === "identifier" && <IdentifierStep flow={flow} />}
      {activeStep === "password" && <PasswordStep flow={flow} />}
      {activeStep === "register" && <RegisterStep flow={flow} />}
    </div>
  );
}

export function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center text-sm text-muted-foreground py-12">
          Đang tải...
        </div>
      }
    >
      <AuthFlowContent />
    </Suspense>
  );
}
