import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "SignalStory",
  description:
    "Turn company signals into founder-quality thought leadership. Context first, writing last.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}
