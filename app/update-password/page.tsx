import { Suspense } from "react";

import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const dynamic = "force-dynamic";

export default function UpdatePasswordPage() {
  return (
    <AuthShell>
      <Suspense>
        <UpdatePasswordForm />
      </Suspense>
    </AuthShell>
  );
}
