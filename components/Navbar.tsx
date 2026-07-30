import Link from "next/link";
import { Logo } from "./Logo";
import { Container } from "./Container";
import type { NavLink } from "@/types";

const NAV_LINKS: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Analyze", href: "/analyze" },
  { label: "Ask", href: "/ask" },
  { label: "About", href: "/about" },
];

/**
 * Top navigation bar. Sticky, translucent, with a subtle bottom border.
 */
export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-navy-800/60 bg-navy-950/70 backdrop-blur supports-[backdrop-filter]:bg-navy-950/50">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" aria-label="RepoLens home" className="flex items-center">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-navy-100 transition-colors hover:bg-navy-800/60 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </Container>
    </header>
  );
}
