import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <AuthShell>
      <Suspense>
        <AuthForm mode="signin" />
      </Suspense>
    </AuthShell>
  );
}
