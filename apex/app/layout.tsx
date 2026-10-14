import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "APEX — Personal assistant workspace",
  description:
    "Local assistant workspace with independent conversation, durable tasks, memory and visual workflows.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
