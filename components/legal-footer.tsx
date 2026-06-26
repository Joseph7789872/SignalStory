import Link from "next/link";

/** Minimal public footer with pricing + legal links (used on unauthed pages). */
export function LegalFooter() {
  return (
    <footer className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 py-8 text-sm text-muted-foreground">
      <Link href="/pricing" className="hover:text-foreground hover:underline">
        Pricing
      </Link>
      <Link href="/privacy" className="hover:text-foreground hover:underline">
        Privacy
      </Link>
      <Link href="/terms" className="hover:text-foreground hover:underline">
        Terms
      </Link>
      <span className="text-muted-foreground/60">
        © {new Date().getFullYear()} SignalStory
      </span>
    </footer>
  );
}
