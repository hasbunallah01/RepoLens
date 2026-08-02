'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  Star,
  GitFork,
  FileText,
  Folder,
  Code2,
  Scale,
  GitBranch,
  ExternalLink,
  Send,
  Bot,
  User,
  FolderTree,
  CheckCircle2,
  Loader2,
  Clock,
  Hash,
  ChevronRight,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useTheme } from '@/components/ThemeProvider';
import {
  MOCK_REPO,
  MOCK_LANGUAGES,
  MOCK_REPO_STRUCTURE,
  MOCK_COMMITS,
  MOCK_INDEXED_FILES,
  MOCK_ANALYSIS_STEPS,
  MOCK_ANALYSIS_PROGRESS,
} from '@/lib/mock-data';

type ChatMessage = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
};

const MOCK_CHAT: ChatMessage[] = [
  { id: 1, role: 'assistant', content: "I've analyzed the repository. Ask me anything about the codebase — architecture, specific files, patterns, or how things work." },
  { id: 2, role: 'user', content: 'How does the app router work in this repo?' },
  { id: 3, role: 'assistant', content: 'The app router is built around a file-system based routing model. The main entry point is `packages/next/src/server/app-render/app-render.tsx`. It handles RSC streaming, nested layouts, and loading states.' },
];

export default function AnalyzePage() {
  return (
    <Suspense fallback={null}>
      <AnalyzePageInner />
    </Suspense>
  );
}

function AnalyzePageInner() {
  const { theme, toggleTheme } = useTheme();
  const searchParams = useSearchParams();
  const repoParam = searchParams.get('repo');
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_CHAT);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [progress, setProgress] = useState(0);

  const repoName = repoParam ? (repoParam.includes('/') ? repoParam : `${repoParam}/repo`) : MOCK_REPO.fullName;

  useEffect(() => {
    if (!isAnalyzing) return;
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { clearInterval(interval); setIsAnalyzing(false); return 100; }
        return p + 2;
      });
    }, 60);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const newMsg: ChatMessage = { id: messages.length + 1, role: 'user', content: chatInput.trim() };
    setMessages([...messages, newMsg]);
    setChatInput('');
    setTimeout(() => {
      const reply: ChatMessage = { id: messages.length + 2, role: 'assistant', content: 'Based on the indexed files, this logic is primarily handled in the core server module. The implementation uses a modular pattern with separate concerns for rendering, routing, and data fetching.' };
      setMessages((prev) => [...prev, reply]);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#1C2B3A]">
      <Navbar theme={theme} onToggleTheme={toggleTheme} />

      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <button onClick={() => window.history.back()} className="flex items-center gap-1 text-gray-500 hover:text-gray-800 transition-colors"><ArrowLeft size={15} /></button>
              <span className="text-gray-400">Repositories</span>
              <ChevronRight size={14} className="text-gray-300" />
              <span className="font-semibold text-[#1C2B3A]">{repoName}</span>
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[#e6f7f3] px-2 py-0.5 text-xs font-medium text-[#0D9A7A]"><CheckCircle2 size={11} />Analyzed</span>
            </div>
            <form className="flex items-center gap-2" onSubmit={(e) => e.preventDefault()}>
              <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 focus-within:border-[#0D9A7A] transition-colors">
                <Search size={14} className="text-gray-400" />
                <input type="text" placeholder="Search files..." className="bg-transparent border-0 outline-none px-2 text-sm w-40 sm:w-56 placeholder:text-gray-400" />
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT */}
          <div className="lg:col-span-3 space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#1C2B3A] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">{MOCK_REPO.owner.charAt(0).toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold text-[#1C2B3A] truncate">{MOCK_REPO.fullName}</h2>
                  <p className="text-xs text-gray-500 mt-0.5 leading-snug">{MOCK_REPO.description}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-600"><Star size={13} className="text-gray-400" />{MOCK_REPO.stars}</div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600"><GitFork size={13} className="text-gray-400" />{MOCK_REPO.forks}</div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600"><FileText size={13} className="text-gray-400" />{MOCK_REPO.fileCount} files</div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600"><Folder size={13} className="text-gray-400" />{MOCK_REPO.directoryCount} dirs</div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600"><Scale size={13} className="text-gray-400" />{MOCK_REPO.license}</div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600"><GitBranch size={13} className="text-gray-400" />{MOCK_REPO.defaultBranch}</div>
              </div>
              <a href={MOCK_REPO.url} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:border-[#0D9A7A] hover:text-[#0D9A7A] transition-colors">
                <ExternalLink size={12} />View on GitHub
              </a>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-2 mb-3">
                <FolderTree size={15} className="text-[#0D9A7A]" />
                <h3 className="text-sm font-semibold text-[#1C2B3A]">Repository Structure</h3>
              </div>
              <div className="space-y-0.5 text-sm">
                {MOCK_REPO_STRUCTURE[0]!.children.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer transition-colors">
                    <ChevronRight size={12} className="text-gray-300" />
                    <Folder size={14} className="text-[#F59E0B]" />
                    <span className="text-xs text-gray-700">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CENTER */}
          <div className="lg:col-span-6 space-y-6">
            {isAnalyzing ? (
              <AnalysisProgress progress={progress} />
            ) : (
              <ChatPanel messages={messages} chatInput={chatInput} setChatInput={setChatInput} onSend={handleSend} />
            )}
            {!isAnalyzing && (
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-center gap-2 mb-4">
                  <GitBranch size={15} className="text-[#0D9A7A]" />
                  <h3 className="text-sm font-semibold text-[#1C2B3A]">Recent Commits</h3>
                </div>
                <div className="space-y-3">
                  {MOCK_COMMITS.map((commit) => (
                    <div key={commit.id} className="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                      <div className="h-7 w-7 rounded-full bg-[#e6f7f3] flex items-center justify-center text-xs font-bold text-[#0D9A7A] flex-shrink-0">{commit.avatar}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">{commit.message}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                          <span className="font-mono">{commit.id}</span><span>by {commit.author}</span><span>{commit.time}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div className="lg:col-span-3 space-y-6">
            {!isAnalyzing && (
              <>
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Hash size={15} className="text-[#0D9A7A]" />
                    <h3 className="text-sm font-semibold text-[#1C2B3A]">Context Metrics</h3>
                  </div>
                  <div className="space-y-3">
                    <MetricBar label="Tokens Used" value="48,210" max="100,000" percent={48} color="#0D9A7A" />
                    <MetricBar label="Files Indexed" value={`${MOCK_ANALYSIS_PROGRESS.analyzed}`} max={`${MOCK_ANALYSIS_PROGRESS.total}`} percent={87} color="#3178C6" />
                    <MetricBar label="Context Relevance" value="High" max="100%" percent={92} color="#F59E0B" />
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-gray-500"><Clock size={12} />Analysis time</span>
                    <span className="font-mono font-medium text-gray-700">{MOCK_ANALYSIS_PROGRESS.elapsed}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Code2 size={15} className="text-[#0D9A7A]" />
                    <h3 className="text-sm font-semibold text-[#1C2B3A]">Languages</h3>
                  </div>
                  <div className="flex h-2.5 w-full overflow-hidden rounded-full">
                    {MOCK_LANGUAGES.map((lang) => (
                      <div key={lang.name} className="h-full" style={{ width: `${lang.percent}%`, backgroundColor: lang.color }} />
                    ))}
                  </div>
                  <div className="mt-4 space-y-2">
                    {MOCK_LANGUAGES.map((lang) => (
                      <div key={lang.name} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-gray-600"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: lang.color }} />{lang.name}</span>
                        <span className="font-medium text-gray-700">{lang.percent}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText size={15} className="text-[#0D9A7A]" />
                    <h3 className="text-sm font-semibold text-[#1C2B3A]">Indexed Files</h3>
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {MOCK_INDEXED_FILES.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-gray-50 transition-colors">
                        <span className="text-xs text-gray-600 truncate flex-1">{file.path}</span>
                        <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">{file.lang}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

function AnalysisProgress({ progress }: { progress: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-8">
      <div className="flex flex-col items-center text-center max-w-md mx-auto">
        <div className="relative h-20 w-20">
          <div className="absolute inset-0 rounded-full border-4 border-gray-100" />
          <div className="absolute inset-0 rounded-full border-4 border-[#0D9A7A] border-r-transparent border-b-transparent transition-transform duration-300" style={{ transform: `rotate(${progress * 3.6}deg)` }} />
          <div className="absolute inset-0 flex items-center justify-center"><Loader2 size={24} className="text-[#0D9A7A] animate-spin" /></div>
        </div>
        <h3 className="mt-6 text-lg font-bold text-[#1C2B3A]">Analyzing Repository...</h3>
        <p className="mt-1 text-sm text-gray-500">Indexing files and building context map</p>
        <div className="mt-6 w-full">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>{progress}%</span><span className="font-mono">{MOCK_ANALYSIS_PROGRESS.elapsed}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-[#0D9A7A] to-[#0b8a6c] transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="mt-8 w-full space-y-3 text-left">
          {MOCK_ANALYSIS_STEPS.map((step) => (
            <div key={step.id} className="flex items-center gap-3">
              {step.status === 'done' ? <CheckCircle2 size={18} className="text-[#0D9A7A] flex-shrink-0" /> : step.status === 'active' ? <Loader2 size={18} className="text-[#0D9A7A] animate-spin flex-shrink-0" /> : <div className="h-[18px] w-[18px] rounded-full border-2 border-gray-200 flex-shrink-0" />}
              <span className={`text-sm ${step.status === 'done' ? 'text-gray-700' : step.status === 'active' ? 'text-[#1C2B3A] font-medium' : 'text-gray-400'}`}>{step.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChatPanel({ messages, chatInput, setChatInput, onSend }: { messages: ChatMessage[]; chatInput: string; setChatInput: (v: string) => void; onSend: (e: React.FormEvent) => void; }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white flex flex-col" style={{ minHeight: '500px', maxHeight: '640px' }}>
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e6f7f3]"><Sparkles size={16} className="text-[#0D9A7A]" /></div>
        <div>
          <h3 className="text-sm font-semibold text-[#1C2B3A]">Ask RepoLens AI</h3>
          <p className="text-xs text-gray-400">Context-aware codebase Q&amp;A</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-[#1C2B3A] text-white' : 'bg-[#e6f7f3] text-[#0D9A7A]'}`}>
              {msg.role === 'user' ? <User size={15} /> : <Bot size={15} />}
            </div>
            <div className={`rounded-2xl px-4 py-2.5 max-w-[80%] ${msg.role === 'user' ? 'bg-[#1C2B3A] text-white rounded-tr-sm' : 'bg-gray-50 text-gray-800 rounded-tl-sm'}`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={onSend} className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus-within:border-[#0D9A7A] transition-colors">
          <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Ask a question about this repository..." className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-gray-400" />
          <button type="submit" className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0D9A7A] text-white hover:bg-[#0b8a6c] transition-colors flex-shrink-0"><Send size={14} /></button>
        </div>
      </form>
    </div>
  );
}

function MetricBar({ label, value, max, percent, color }: { label: string; value: string; max: string; percent: number; color: string; }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-700">{value} <span className="text-gray-400">/ {max}</span></span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
