"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Sun, Rocket } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Container } from "@/components/Container";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Analyze", href: "/analyze" },
  { label: "Ask", href: "/ask" },
  { label: "About", href: "/about" },
  { label: "Docs", href: "/docs" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <Container>
        <nav className="flex h-16 items-center justify-between gap-4">
          {/* Left: logo */}
          <Logo size={30} />

          {/* Center: nav links (desktop) */}
          <ul className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    "relative py-5 text-sm font-medium transition-colors",
                    isActive(link.href)
                      ? "text-brand-teal"
                      : "text-brand-navy/70 hover:text-brand-navy",
                  )}
                >
                  {link.label}
                  {isActive(link.href) && (
                    <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-teal" />
                  )}
                </Link>
              </li>
            ))}
          </ul>

          {/* Right: theme toggle + CTA (desktop) */}
          <div className="hidden items-center gap-3 md:flex">
            <button
              type="button"
              aria-label="Toggle theme"
              className="flex h-9 w-9 items-center justify-center rounded-full text-brand-navy/70 transition-colors hover:bg-muted hover:text-brand-navy"
            >
              <Sun className="h-5 w-5" />
            </button>
            <Link
              href="/analyze"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-teal px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-teal-600"
            >
              <Rocket className="h-4 w-4" />
              Analyze Repository
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-brand-navy md:hidden"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </nav>
      </Container>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <Container>
            <ul className="flex flex-col py-2">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "block rounded-lg px-2 py-3 text-base font-medium",
                      isActive(link.href)
                        ? "text-brand-teal"
                        : "text-brand-navy/80 hover:bg-muted",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/analyze"
              onClick={() => setOpen(false)}
              className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-teal px-4 py-3 text-sm font-semibold text-white"
            >
              <Rocket className="h-4 w-4" />
              Analyze Repository
            </Link>
          </Container>
        </div>
      )}
    </header>
  );
}
