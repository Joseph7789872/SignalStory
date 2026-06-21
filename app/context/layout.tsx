import { AppShell } from "@/components/app-shell";

export default function ContextLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
