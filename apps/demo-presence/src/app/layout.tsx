import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flock — Who's Here",
  description: "Minimal presence widget demo using @flock-sdk/react",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
