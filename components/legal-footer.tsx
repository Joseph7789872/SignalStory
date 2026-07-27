import Link from "next/link";

/** Minimal public footer with legal links (used on unauthed pages). */
export function LegalFooter() {
  return (
    <footer className="mt-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t px-6 py-10 text-sm text-muted-foreground">
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
