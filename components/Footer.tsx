import Link from "next/link";
import { Heart } from "lucide-react";
import { Container } from "@/components/Container";
import { Logo } from "@/components/Logo";

const FOOTER_LINKS = [
  { label: "Home", href: "/" },
  { label: "Analyze", href: "/analyze" },
  { label: "Ask", href: "/ask" },
  { label: "About", href: "/about" },
  { label: "Docs", href: "/docs" },
];

/**
 * Site-wide footer: logo, quick links, attribution + copyright.
 */
export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-background">
      <Container className="py-8">
        <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
          <Logo size={28} />

          <nav className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-brand-navy/70 transition-colors hover:text-brand-teal"
              >
                {link.label}
              </Link>
            ))}
            <a
              href="https://github.com/hasbunallah01/RepoLens"
              target="_blank"
              rel="noreferrer noopener"
              className="text-sm font-medium text-brand-navy/70 transition-colors hover:text-brand-teal"
            >
              GitHub
            </a>
          </nav>

          <div className="flex flex-col items-center gap-1 md:items-end">
            <p className="flex items-center gap-1.5 text-sm text-brand-navy/80">
              Made with
              <Heart className="h-4 w-4 fill-red-500 text-red-500" />
              for developers
            </p>
            <p className="text-xs text-muted-foreground">
              © {year} RepoLens. All rights reserved.
            </p>
          </div>
        </div>
      </Container>
    </footer>
  );
}
