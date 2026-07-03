import { Suspense } from "react";

import { ResetRequestForm } from "@/components/auth/reset-request-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <Suspense>
        <ResetRequestForm />
      </Suspense>
    </AuthShell>
  );
}
