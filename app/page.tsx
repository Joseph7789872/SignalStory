import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          SignalStory
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Turn company momentum into thought leadership.
        </h1>
        <p className="text-lg text-muted-foreground">
          Most AI content feels like AI because it starts with writing. Great
          content starts with context. SignalStory detects meaningful signals,
          finds the story, builds the narrative, and writes last — gated by an
          anti-slop editor so it sounds like a founder, not a model.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild size="lg">
          <Link href="/sign-up">Get started</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>
    </main>
  );
}
