import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";
import { LegalFooter } from "@/components/legal-footer";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 items-center justify-center p-6">
        <Suspense>
          <AuthForm mode="signin" />
        </Suspense>
      </main>
      <LegalFooter />
    </div>
  );
}
