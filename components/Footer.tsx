import Link from "next/link";
import { Container } from "./Container";
import { Logo } from "./Logo";

const FOOTER_LINKS: { label: string; href: string; external?: boolean }[] = [
  { label: "Home", href: "/" },
  { label: "Analyze", href: "/analyze" },
  { label: "Ask", href: "/ask" },
  { label: "About", href: "/about" },
  {
    label: "Docs",
    href: "https://github.com/hasbunallah01/RepoLens/tree/main/docs",
    external: true,
  },
  {
    label: "GitHub",
    href: "https://github.com/hasbunallah01/RepoLens",
    external: true,
  },
];

/**
 * Site-wide footer with project attribution and quick links.
 */
export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-100 bg-white">
      <Container className="flex flex-col items-center gap-6 py-12 text-center">
        <Logo size={28} />

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-600">
          {FOOTER_LINKS.map((link) =>
            link.external ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer noopener"
                className="hover:text-brand-navy"
              >
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href} className="hover:text-brand-navy">
                {link.label}
              </Link>
            ),
          )}
        </nav>

        <p className="text-sm text-slate-500">
          Made with <span aria-hidden="true">❤️</span> for developers
        </p>
        <p className="text-xs text-slate-400">
          © {year} RepoLens. All rights reserved.
        </p>
      </Container>
    </footer>
  );
}
