import Link from "next/link";
import { Activity } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Shared header for public, unauthenticated pages (pricing, legal). */
export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-brand">
            <Activity className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <span className="text-base font-bold tracking-tight">SignalStory</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/sign-up">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
