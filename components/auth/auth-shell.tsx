import Link from "next/link";
import { Activity, BookOpen, Gauge, ShieldCheck } from "lucide-react";

const POINTS = [
  {
    icon: Gauge,
    title: "A significance gate",
    desc: "Weak signals stop before they ever become content.",
  },
  {
    icon: BookOpen,
    title: "Grounded in your knowledge",
    desc: "Every claim is traced to cited proof from your own store.",
  },
  {
    icon: ShieldCheck,
    title: "An anti-slop editor",
    desc: "Rejects anything a generic model could have written.",
  },
];

/** Split-screen shell for the auth pages: navy brand panel + form area. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel (desktop only) */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_30%_10%,hsl(var(--brand)/0.25),transparent)]"
          aria-hidden
        />
        <Link
          href="/"
          className="relative flex items-center gap-2 text-sidebar-accent-foreground"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-brand">
            <Activity className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <span className="text-base font-bold tracking-tight">SignalStory</span>
        </Link>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-sidebar-accent-foreground">
            Context first. Writing last.
          </h2>
          <p className="mt-3 text-sidebar-foreground">
            Turn real company moments into founder-quality content — grounded in
            your context at every step.
          </p>
          <ul className="mt-8 space-y-5">
            {POINTS.map((p) => {
              const Icon = p.icon;
              return (
                <li key={p.title} className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-active">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-sidebar-accent-foreground">
                      {p.title}
                    </p>
                    <p className="text-sm text-sidebar-muted">{p.desc}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="relative text-xs text-sidebar-muted">
          © {new Date().getFullYear()} SignalStory
        </p>
      </div>

      {/* Form area */}
      <div className="flex flex-col items-center justify-center px-6 py-12">
        <Link
          href="/"
          className="mb-8 flex items-center gap-2 lg:hidden"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-brand">
            <Activity className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <span className="text-base font-bold tracking-tight">SignalStory</span>
        </Link>
        {children}
      </div>
    </div>
  );
}
