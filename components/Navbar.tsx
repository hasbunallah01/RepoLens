'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Search, Sun, Moon, Menu, X } from 'lucide-react';
import Logo from './Logo';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/analyze', label: 'Analyze' },
  { href: '/ask', label: 'Ask' },
  { href: '/docs', label: 'Docs' },
  { href: '/about', label: 'About' },
];

interface NavbarProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export default function Navbar({ theme, onToggleTheme }: NavbarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <Logo size={36} />
            <span className="text-xl font-bold tracking-tight">
              <span className="text-[#1C2B3A]">Repo</span>
              <span className="text-[#0D9A7A]">Lens</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link key={link.href} href={link.href} className={`relative px-4 py-2 text-sm font-medium transition-colors ${isActive ? 'text-[#0D9A7A]' : 'text-gray-600 hover:text-gray-900'}`}>
                  {link.label}
                  {isActive && <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-[#0D9A7A]" />}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <button onClick={onToggleTheme} className="hidden md:flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 transition-colors" aria-label="Toggle theme">
              {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <Link href="/analyze" className="hidden md:inline-flex items-center gap-2 rounded-lg bg-[#0D9A7A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0b8a6c] transition-colors">
              <Search size={15} />
              Analyze Repository
            </Link>
            <button className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-1">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className={`block px-4 py-2.5 rounded-lg text-sm font-medium ${isActive ? 'bg-[#e6f7f3] text-[#0D9A7A]' : 'text-gray-700 hover:bg-gray-50'}`}>
                {link.label}
              </Link>
            );
          })}
          <div className="pt-2 border-t border-gray-100">
            <Link href="/analyze" onClick={() => setMobileOpen(false)} className="flex items-center justify-center gap-2 w-full rounded-lg bg-[#0D9A7A] px-4 py-2.5 text-sm font-semibold text-white">
              <Search size={15} />
              Analyze Repository
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
