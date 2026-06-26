import type { ReactNode } from "react";
import { RootProvider } from "fumadocs-ui/provider";
import type { Metadata } from "next";
import "fumadocs-ui/style.css";

export const metadata: Metadata = {
  title: {
    default: "Flock — Real-Time Presence SDK",
    template: "%s — Flock Docs",
  },
  description:
    "Self-hostable, open-source SDK for live cursors and multiplayer presence. Under 10 lines to add real-time cursors to any web app.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
