import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reading Notes - LLM-Powered English Learning",
  description: "An intelligent note-taking tool for English reading classes",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
