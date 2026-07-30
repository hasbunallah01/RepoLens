import Link from "next/link";
import { Container } from "./Container";
import { Logo } from "./Logo";

/**
 * Site-wide footer with project attribution and quick links.
 */
export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-navy-800/60 bg-navy-950">
      <Container className="flex flex-col items-start gap-6 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <Logo />
          <p className="text-sm text-navy-300">
            Understand any codebase with fewer tokens.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-sm text-navy-300 md:items-end">
          <div className="flex items-center gap-5">
            <Link href="/" className="hover:text-white">
              Home
            </Link>
            <Link href="/about" className="hover:text-white">
              About
            </Link>
            <a
              href="https://github.com/hasbunallah01/RepoLens"
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-white"
            >
              GitHub
            </a>
          </div>
          <p className="text-xs text-navy-400">
            © {year} RepoLens. Built for the Build with Paritok Hackathon.
          </p>
        </div>
      </Container>
    </footer>
  );
}
