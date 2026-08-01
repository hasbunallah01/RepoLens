"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "./Logo";
import { Container } from "./Container";
import { Button } from "./Button";
import { cn } from "@/lib/utils";
import type { NavLink } from "@/types";

const NAV_LINKS: (NavLink & { external?: boolean })[] = [
  { label: "Home", href: "/" },
  { label: "Analyze", href: "/analyze" },
  { label: "Ask", href: "/ask" },
  { label: "About", href: "/about" },
  { label: "Docs", href: "https://github.com/hasbunallah01/RepoLens#readme", external: true },
];

/**
 * Top navigation bar. Light, sticky, with a subtle bottom border and a
 * teal underline on the active route. Collapses to a hamburger menu on
 * small screens.
 */
export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" aria-label="RepoLens home" className="flex items-center">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const active = !link.external && pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noreferrer noopener" : undefined}
                className={cn(
                  "relative rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "text-brand-teal"
                    : "text-slate-600 hover:text-brand-navy",
                )}
              >
                {link.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-[1px] h-0.5 rounded-full bg-brand-teal" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:flex">
          <Button href="/analyze" variant="brand" size="md">
            Analyze Repository
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Toggle navigation menu"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-brand-navy hover:bg-slate-100 md:hidden"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path
                d="M4 6h16M4 12h16M4 18h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </Container>

      {open && (
        <div className="border-t border-slate-200 bg-white md:hidden">
          <Container className="flex flex-col gap-1 py-3">
            {NAV_LINKS.map((link) => {
              const active = !link.external && pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noreferrer noopener" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium",
                    active ? "bg-brand-teal-100/50 text-brand-teal" : "text-slate-600 hover:bg-slate-100",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
            <Button href="/analyze" variant="brand" size="md" className="mt-2 w-full">
              Analyze Repository
            </Button>
          </Container>
        </div>
      )}
    </header>
  );
}
