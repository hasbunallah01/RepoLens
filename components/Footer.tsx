import Link from 'next/link';
import Logo from './Logo';
import { Heart } from 'lucide-react';

const FOOTER_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/analyze', label: 'Analyze' },
  { href: '/ask', label: 'Ask' },
  { href: '/about', label: 'About' },
  { href: '/docs', label: 'Docs' },
  { href: 'https://github.com/hasbunallah01/RepoLens', label: 'GitHub' },
];

export default function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Logo size={28} />
            <span className="text-base font-bold">
              <span className="text-[#1C2B3A]">Repo</span>
              <span className="text-[#0D9A7A]">Lens</span>
            </span>
          </Link>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
            {FOOTER_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm text-gray-500 hover:text-gray-800 transition-colors" target={link.href.startsWith('http') ? '_blank' : undefined} rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}>
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col items-center md:items-end gap-0.5">
            <span className="flex items-center gap-1 text-xs text-gray-400">
              Made with <Heart size={11} className="text-red-500 fill-red-500" /> for developers
            </span>
            <span className="text-xs text-gray-400">© 2025 RepoLens. All rights reserved.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
