import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </main>
  );
}
