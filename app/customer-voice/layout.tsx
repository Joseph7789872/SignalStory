import { AppShell } from "@/components/app-shell";

export default function CustomerVoiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
