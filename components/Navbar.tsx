import Link from "next/link";
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
 */
export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-100 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" aria-label="RepoLens home" className="flex items-center">
          <Logo size={30} />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const isExternal = link.href.startsWith("http");
            const className =
              link.href === "/"
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
        <Button href="/analyze" size="md" className="hidden sm:inline-flex">
          Analyze Repository
        </Button>
      </Container>
    </header>
  );
}
