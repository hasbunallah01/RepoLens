"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "./Logo";
import { Container } from "./Container";
import { Button } from "./Button";
import type { NavLink } from "@/types";

const NAV_LINKS: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Analyze", href: "/analyze" },
  { label: "Ask", href: "/ask" },
  { label: "About", href: "/about" },
  { label: "Docs", href: "https://github.com/hasbunallah01/RepoLens/tree/main/docs" },
];

/**
 * Top navigation bar. Sticky, light, with a subtle bottom border.
 * Highlights the active section and swaps the CTA label on /analyze.
 */
export function Navbar() {
  const pathname = usePathname();
  // Decorative only for now — no dark theme styles exist yet in the app.
  // Wiring this up to a real ThemeProvider is left as a follow-up (see PR notes).
  const [isDark, setIsDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const ctaLabel = pathname === "/analyze" ? "Analyze New Repo" : "Analyze Repository";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-100 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" aria-label="RepoLens home" className="flex items-center">
          <Logo size={30} />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const isExternal = link.href.startsWith("http");
            const isActive = !isExternal && link.href === pathname;
            const className = isActive
              ? "rounded-md px-3 py-2 text-sm font-medium text-brand-teal"
              : "rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-brand-navy";
            return isExternal ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer noopener"
                className={className}
              >
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href} className={className}>
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsDark((v) => !v)}
            aria-label="Toggle theme"
            aria-pressed={isDark}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100"
          >
            {isDark ? (
              <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
                <path
                  d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
                <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6" />
                <path
                  d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
          <Button href="/analyze" size="md" className="hidden sm:inline-flex">
            {ctaLabel}
          </Button>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              {mobileOpen ? (
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </Container>

      {mobileOpen ? (
        <div className="border-t border-slate-100 bg-white px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => {
              const isExternal = link.href.startsWith("http");
              const isActive = !isExternal && link.href === pathname;
              const className = isActive
                ? "rounded-md px-3 py-2 text-sm font-medium text-brand-teal"
                : "rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50";
              return isExternal ? (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={className}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className={className}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <Button href="/analyze" size="md" className="mt-3 w-full justify-center">
            {ctaLabel}
          </Button>
        </div>
      ) : null}
    </header>
  );
}
