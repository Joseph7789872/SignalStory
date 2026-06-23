import Link from "next/link";

import { SignOutButton } from "@/components/sign-out-button";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/dashboard" className="font-semibold">
              SignalStory
            </Link>
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground"
            >
              Signals
            </Link>
            <Link
              href="/context"
              className="text-muted-foreground hover:text-foreground"
            >
              Context
            </Link>
            <Link
              href="/customer-voice"
              className="text-muted-foreground hover:text-foreground"
            >
              Customer voice
            </Link>
            <Link
              href="/integrations"
              className="text-muted-foreground hover:text-foreground"
            >
              Integrations
            </Link>
            <Link
              href="/knowledge"
              className="text-muted-foreground hover:text-foreground"
            >
              Knowledge
            </Link>
            <Link
              href="/analytics"
              className="text-muted-foreground hover:text-foreground"
            >
              Analytics
            </Link>
            <Link
              href="/prompts"
              className="text-muted-foreground hover:text-foreground"
            >
              Prompts
            </Link>
            <Link
              href="/team"
              className="text-muted-foreground hover:text-foreground"
            >
              Team
            </Link>
          </nav>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
