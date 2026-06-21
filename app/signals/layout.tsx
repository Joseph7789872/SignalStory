import { AppShell } from "@/components/app-shell";

export default function SignalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
