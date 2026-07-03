"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SessionState = "checking" | "ready" | "missing";

export function UpdatePasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [session, setSession] = useState<SessionState>("checking");

  // Establish the recovery session. Depending on the Supabase email template
  // the link lands with a ?code= (PKCE) or with the session already set via
  // the URL hash (handled by supabase-js automatically). Cover both.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || s) setSession("ready");
    });

    (async () => {
      const code = params.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!cancelled) setSession(error ? "missing" : "ready");
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!cancelled) setSession(data.session ? "ready" : "missing");
    })();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [params]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm shadow-md">
      <CardHeader>
        <CardTitle className="text-2xl">Set a new password</CardTitle>
        <CardDescription>
          Choose a new password for your SignalStory account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {session === "missing" ? (
          <div className="space-y-4">
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              This reset link is invalid or has expired. Request a new one.
            </p>
            <Button asChild className="w-full">
              <Link href="/reset-password">Request a new link</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="pr-10"
                  disabled={session === "checking"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                At least 6 characters.
              </p>
            </div>
            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={busy || session === "checking"}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {session === "checking"
                ? "Verifying link…"
                : busy
                  ? "Updating…"
                  : "Update password"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
