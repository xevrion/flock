import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Flock — Collaborative Canvas",
  description: "Live multiplayer cursors on a shared canvas, powered by Flock.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
