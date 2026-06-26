import type { Metadata } from "next";

import "./globals.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const DESCRIPTION =
  "Turn company signals into founder-quality thought leadership. Context first, writing last.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "SignalStory — founder-quality content, context first",
    template: "%s — SignalStory",
  },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "SignalStory",
    title: "SignalStory — founder-quality content, context first",
    description: DESCRIPTION,
    url: APP_URL,
    // Drop a public/og.png to enable a rich preview image automatically.
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "SignalStory — founder-quality content, context first",
    description: DESCRIPTION,
  },
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
