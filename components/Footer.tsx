import Link from "next/link";
import { Container } from "./Container";
import { Logo } from "./Logo";

/**
 * Site-wide footer with project attribution and quick links.
 */
export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-200 bg-white">
      <Container className="py-10">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <Logo />

          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
            <Link href="/" className="hover:text-brand-navy">
              Home
            </Link>
            <Link href="/analyze" className="hover:text-brand-navy">
              Analyze
            </Link>
            <Link href="/ask" className="hover:text-brand-navy">
              Ask
            </Link>
            <Link href="/about" className="hover:text-brand-navy">
              About
            </Link>
            <a
              href="https://github.com/hasbunallah01/RepoLens#readme"
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-brand-navy"
            >
              Docs
            </a>
            <a
              href="https://github.com/hasbunallah01/RepoLens"
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-brand-navy"
            >
              GitHub
            </a>
          </nav>

          <p className="text-sm text-slate-500">Made with ❤️ for developers</p>
        </div>

        <p className="mt-8 border-t border-slate-100 pt-6 text-center text-xs text-slate-400">
          © {year} RepoLens. All rights reserved.
        </p>
      </Container>
    </footer>
  );
}
