"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  FileText,
  Menu,
  Plug,
  Plus,
  ScrollText,
  Settings,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Extra path prefixes that should also mark this item active. */
  match?: string[];
};

type NavGroup = { label: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { label: "Signals", href: "/dashboard", icon: Activity, match: ["/signals"] },
      { label: "Calendar", href: "/calendar", icon: Calendar },
      { label: "Knowledge", href: "/knowledge", icon: BookOpen },
    ],
  },
  {
    label: "Setup",
    items: [
      { label: "Context", href: "/context", icon: Building2 },
      { label: "Integrations", href: "/integrations", icon: Plug },
      { label: "Team", href: "/team", icon: Users },
    ],
  },
  {
    label: "Admin",
    items: [
      { label: "Analytics", href: "/analytics", icon: BarChart3 },
      { label: "Prompts", href: "/prompts", icon: FileText },
      { label: "Audit", href: "/audit", icon: ScrollText },
      { label: "Trash", href: "/trash", icon: Trash2 },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

function isActive(pathname: string, item: NavItem): boolean {
  const targets = [item.href, ...(item.match ?? [])];
  return targets.some((t) => pathname === t || pathname.startsWith(`${t}/`));
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? "";

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2 px-5">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-2 text-sidebar-accent-foreground"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-brand">
            <Activity className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <span className="text-base font-bold tracking-tight">SignalStory</span>
        </Link>
      </div>

      {/* Primary action */}
      <div className="px-3 pb-2">
        <Button asChild className="w-full justify-start" size="default">
          <Link href="/signals/new" onClick={onNavigate}>
            <Plus className="h-4 w-4" />
            New signal
          </Link>
        </Button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {NAV.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "h-5 w-1 shrink-0 rounded-full transition-colors",
                          active ? "bg-sidebar-active" : "bg-transparent",
                        )}
                        aria-hidden
                      />
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active
                            ? "text-sidebar-active"
                            : "text-sidebar-muted group-hover:text-sidebar-accent-foreground",
                        )}
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-sidebar-border px-4 py-3">
        <SignOutButton />
        <ThemeToggle />
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();

  // Close the mobile drawer whenever the route changes.
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border md:block">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-sidebar px-4 text-sidebar-accent-foreground md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-sidebar-accent"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <Activity className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <span className="text-sm font-bold tracking-tight">SignalStory</span>
        </Link>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-navy/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 w-72 animate-fade-in shadow-lg">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="md:pl-64">
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
