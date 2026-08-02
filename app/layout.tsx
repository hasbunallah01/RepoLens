import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "RepoLens — Understand Any GitHub Repository with AI",
    template: "%s · RepoLens",
  },
  description:
    "RepoLens analyzes repositories, builds intelligent context, and answers natural-language questions about the codebase.",
  applicationName: "RepoLens",
  authors: [{ name: "RepoLens" }],
  keywords: [
    "RepoLens",
    "GitHub",
    "Repository Intelligence",
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
  },
  openGraph: {
    title: "RepoLens — Understand Any GitHub Repository with AI",
    description:
      "Analyze repositories, build intelligent context, and ask natural-language questions about any codebase.",
    type: "website",
    images: [{ url: "/assets/repolens-mark.png", alt: "RepoLens logo" }],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable} bg-background`}>
      <body className="min-h-screen flex flex-col bg-page font-sans text-foreground">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
