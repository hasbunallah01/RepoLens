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
  openGraph: {
    title: "RepoLens — Understand any codebase with fewer tokens",
    description:
      "Token-efficient codebase understanding, powered by Paritok. Built for the Build with Paritok Hackathon.",
    type: "website",
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
