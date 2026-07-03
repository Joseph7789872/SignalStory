import Link from "next/link";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md border-dashed">
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <SearchX className="h-6 w-6" />
          </span>
          <div>
            <p className="font-semibold">Page not found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              That page doesn&apos;t exist or may have been moved.
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
