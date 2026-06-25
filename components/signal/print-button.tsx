"use client";

import { Button } from "@/components/ui/button";

/** Triggers the browser print dialog (→ Save as PDF). Hidden when printing. */
export function PrintButton() {
  return (
    <Button size="sm" onClick={() => window.print()}>
      Print / Save as PDF
    </Button>
  );
}
