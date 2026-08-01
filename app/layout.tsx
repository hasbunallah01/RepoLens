import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "RepoLens — Understand any codebase with fewer tokens",
    template: "%s · RepoLens",
  },
  description:
    "RepoLens helps developers understand any GitHub repository by retrieving only the relevant code before sending requests through Paritok, reducing token usage while maintaining answer quality.",
  applicationName: "RepoLens",
  authors: [{ name: "RepoLens" }],
  keywords: [
    "RepoLens",
    "Paritok",
    "Token Efficiency",
    "GitHub",
    "Codebase AI",
    "Developer Tools",
  ],
  icons: {
    icon: [
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/favicon/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    other: [
      { rel: "android-chrome-192x192", url: "/favicon/android-chrome-192x192.png" },
      { rel: "android-chrome-512x512", url: "/favicon/android-chrome-512x512.png" },
    ],
  },
  openGraph: {
    title: "RepoLens — Understand any codebase with fewer tokens",
    description:
      "Token-efficient codebase understanding, powered by Paritok. Built for the Build with Paritok Hackathon.",
    type: "website",
    images: [{ url: "/assets/logo.png", alt: "RepoLens logo" }],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-navy-gradient">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
