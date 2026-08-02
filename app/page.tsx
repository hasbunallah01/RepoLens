'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  ArrowRight,
  Zap,
  Bot,
  Files,
  LayoutTemplate,
  Globe,
  Star,
  GitFork,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useTheme } from '@/components/ThemeProvider';
import { EXAMPLE_REPOS, MOCK_FEATURES } from '@/lib/mock-data';

const ICON_MAP: Record<string, typeof Zap> = {
  Zap,
  Bot,
  Files,
  LayoutTemplate,
  Search,
  Globe,
};

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const [repoUrl, setRepoUrl] = useState('');
  const router = useRouter();

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    if (repoUrl.trim()) {
      router.push(`/analyze?repo=${encodeURIComponent(repoUrl.trim())}`);
    } else {
      router.push('/analyze');
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#1C2B3A]">
      <Navbar theme={theme} onToggleTheme={toggleTheme} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[900px] h-[600px] bg-gradient-to-br from-[#e6f7f3] via-[#f0fdfa] to-transparent rounded-full blur-3xl opacity-70" />
          <div className="absolute right-0 top-40 w-[400px] h-[400px] bg-gradient-to-br from-[#fef3c7] to-transparent rounded-full blur-3xl opacity-50" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#0D9A7A]/20 bg-[#e6f7f3] px-4 py-1.5 mb-6">
              <Sparkles size={14} className="text-[#0D9A7A]" />
              <span className="text-sm font-medium text-[#0D9A7A]">AI-Powered Repository Analysis</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#1C2B3A] leading-[1.1]">
              Understand any{' '}
              <span className="relative inline-block">
                <span className="relative z-10 text-[#0D9A7A]">repository</span>
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none" preserveAspectRatio="none">
                  <path d="M2 9C50 3 150 3 198 9" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </span>
              <br />
              in seconds.
            </h1>

            <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Paste a GitHub URL and let AI analyze the codebase, answer your questions, and give you deep architectural insights — no clone required.
            </p>

            <form onSubmit={handleAnalyze} className="mt-10 mx-auto max-w-2xl">
              <div className="flex flex-col sm:flex-row items-stretch gap-3 sm:gap-2 sm:items-center bg-white rounded-2xl border border-gray-200 shadow-lg shadow-gray-200/50 p-2 sm:p-2.5 focus-within:border-[#0D9A7A] focus-within:ring-2 focus-within:ring-[#0D9A7A]/20 transition-all">
                <div className="flex items-center flex-1 px-3">
                  <Search size={18} className="text-gray-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="Paste a GitHub repository URL..."
                    className="w-full bg-transparent border-0 outline-none px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400"
                  />
                </div>
                <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D9A7A] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0b8a6c] transition-colors flex-shrink-0">
                  Analyze
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-gray-400">Try:</span>
              {EXAMPLE_REPOS.map((repo) => (
                <Link key={repo} href={`/analyze?repo=${encodeURIComponent(repo)}`} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 hover:border-[#0D9A7A] hover:text-[#0D9A7A] transition-colors">
                  {repo}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-[#fafafa] border-y border-gray-100 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1C2B3A]">Everything you need to explore code</h2>
            <p className="mt-4 text-gray-600">Powerful features designed to help you understand any codebase quickly and deeply.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {MOCK_FEATURES.map((feature) => {
              const Icon = ICON_MAP[feature.icon] ?? Zap;
              return (
                <div key={feature.title} className="group rounded-2xl border border-gray-200 bg-white p-6 hover:shadow-lg hover:shadow-gray-200/50 hover:border-[#0D9A7A]/30 transition-all">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e6f7f3] text-[#0D9A7A] group-hover:bg-[#0D9A7A] group-hover:text-white transition-colors">
                    <Icon size={22} />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-[#1C2B3A]">{feature.title}</h3>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1C2B3A]">How it works</h2>
            <p className="mt-4 text-gray-600">Three simple steps from URL to full understanding.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Paste a URL', description: 'Drop any public GitHub repository link into the search bar.', icon: Search },
              { step: '02', title: 'AI Analyzes', description: 'We index files, rank relevance, and build a deep context map of the codebase.', icon: Bot },
              { step: '03', title: 'Ask & Explore', description: 'Ask questions in plain English and get answers grounded in the actual code.', icon: Sparkles },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="relative text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1C2B3A] to-[#2a3f52] text-white shadow-lg">
                    <Icon size={26} />
                  </div>
                  <div className="mt-4 text-xs font-bold text-[#0D9A7A] tracking-widest">STEP {item.step}</div>
                  <h3 className="mt-2 text-lg font-semibold text-[#1C2B3A]">{item.title}</h3>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed max-w-xs mx-auto">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stats banner */}
      <section className="bg-[#1C2B3A] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '10k+', label: 'Repos Analyzed' },
              { value: '500k+', label: 'Files Indexed' },
              { value: '< 30s', label: 'Avg Analysis Time' },
              { value: '99.9%', label: 'Uptime' },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-3xl sm:text-4xl font-bold text-white">{stat.value}</div>
                <div className="mt-1 text-sm text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Showcase / preview card */}
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1C2B3A]">A clear view of every codebase</h2>
            <p className="mt-4 text-gray-600">Repository details, language breakdown, recent commits, and indexed files — all in one place.</p>
          </div>
          <div className="mx-auto max-w-4xl rounded-2xl border border-gray-200 bg-white shadow-xl shadow-gray-200/50 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-yellow-400" />
                <div className="h-3 w-3 rounded-full bg-green-400" />
              </div>
              <div className="ml-3 flex-1 text-center text-xs text-gray-400 font-mono">repolens.app/analyze</div>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-[#1C2B3A] flex items-center justify-center text-white text-xs font-bold">N</div>
                  <div>
                    <div className="text-sm font-semibold text-[#1C2B3A]">vercel / next.js</div>
                    <div className="text-xs text-gray-400">The React Framework for the Web</div>
                  </div>
                </div>
                <div className="mt-4 flex gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Star size={12} /> 125k</span>
                  <span className="flex items-center gap-1"><GitFork size={12} /> 24.3k</span>
                  <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-[#0D9A7A]" /> MIT</span>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 p-5 flex flex-col items-center justify-center">
                <div className="relative h-20 w-20">
                  <div className="absolute inset-0 rounded-full border-8 border-gray-100" />
                  <div className="absolute inset-0 rounded-full border-8 border-[#0D9A7A] border-r-transparent border-b-transparent" style={{ transform: 'rotate(45deg)' }} />
                </div>
                <div className="mt-3 text-xs font-medium text-gray-600">TypeScript 60%</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#fafafa] border-t border-gray-100 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#1C2B3A]">Ready to explore a codebase?</h2>
          <p className="mt-4 text-gray-600 max-w-xl mx-auto">Start analyzing any public GitHub repository in seconds. No sign-up required.</p>
          <Link href="/analyze" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#0D9A7A] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0b8a6c] transition-colors shadow-lg shadow-[#0D9A7A]/20">
            Start Analyzing
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
