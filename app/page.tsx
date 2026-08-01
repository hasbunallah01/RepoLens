import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { Hero } from "@/components/Hero";
import { FeatureCard } from "@/components/FeatureCard";
import { Button } from "@/components/Button";
export const metadata: Metadata = {
  title: "RepoLens — Understand Any GitHub Repository with AI",
  description:
    "RepoLens analyzes repositories, builds intelligent context, and answers natural-language questions about the codebase.",
};

type IconName = "search" | "message" | "sparkles" | "chart" | "folder" | "brain" | "layers" | "globe";

const STEPS = [
  {
    n: 1,
    title: "Analyze",
    description: "RepoLens scans the repository structure and indexes the important files.",
    icon: "folder" as IconName,
  },
  {
    n: 2,
    title: "Understand",
    description: "The AI builds a contextual understanding of the codebase.",
    icon: "brain" as IconName,
  },
  {
    n: 3,
    title: "Ask",
    description: "Ask questions in plain English and receive code-aware answers.",
    icon: "message" as IconName,
  },
] as const;

interface HomeFeature {
  title: string;
  description: string;
  icon: IconName;
  tone: "teal" | "gold";
}

const FEATURES: HomeFeature[] = [
  {
    title: "Fast Analysis",
    description: "Analyze repositories in seconds with our optimized engine.",
    icon: "sparkles",
    tone: "gold",
  },
  {
    title: "AI-Powered Answers",
    description: "Get accurate, context-aware answers to your questions.",
    icon: "message",
    tone: "teal",
  },
  {
    title: "Smart File Ranking",
    description: "We rank and select the most relevant files for better answers.",
    icon: "folder",
    tone: "gold",
  },
  {
    title: "Architecture Insights",
    description: "Understand the overall structure and design patterns of the codebase.",
    icon: "layers",
    tone: "teal",
  },
  {
    title: "Context-Aware Search",
    description: "Search and explore with deep understanding of the codebase.",
    icon: "search",
    tone: "gold",
  },
  {
    title: "Public Repos Only",
    description: "Works with any public GitHub repository instantly.",
    icon: "globe",
    tone: "teal",
  },
];

function Icon({ name }: { name: IconName }) {
  const common = "h-5 w-5";
  switch (name) {
    case "search":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "message":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path
            d="M21 12a8 8 0 1 1-3.1-6.32L21 4l-1.3 3.9A8 8 0 0 1 21 12Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "sparkles":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path
            d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "chart":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M4 20V10M10 20V4M16 20v-6M22 20H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "folder":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path
            d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "brain":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path
            d="M9 4a3 3 0 0 0-3 3v.3A3 3 0 0 0 4 10v1a3 3 0 0 0 1 2.24V15a3 3 0 0 0 3 3 3 3 0 0 0 3-3V7a3 3 0 0 0-2-2.83A3 3 0 0 0 9 4Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M15 4a3 3 0 0 1 3 3v.3a3 3 0 0 1 2 2.7v1a3 3 0 0 1-1 2.24V15a3 3 0 0 1-3 3 3 3 0 0 1-3-3V7a3 3 0 0 1 2-2.83A3 3 0 0 1 15 4Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "layers":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M12 3 3 8l9 5 9-5-9-5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M3 12l9 5 9-5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M3 16l9 5 9-5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case "globe":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </svg>
      );
  }
}

export default function HomePage() {
  return (
    <div className="bg-gradient-to-b from-white via-brand-teal-100/10 to-white">
      {/* Hero */}
      <Section className="pt-14 pb-16 md:pt-20 md:pb-20">
        <Container>
          <Hero />
        </Container>
      </Section>

      {/* How It Works */}
      <Section compact className="border-t border-slate-200">
        <Container>
          <div className="mb-12 text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-brand-gold-600">
              How It Works
            </span>
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-6">
            {STEPS.map((step, i) => (
              <div key={step.n} className="relative flex flex-col items-center text-center">
                <div className="relative">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-teal-100/60 text-brand-teal ring-1 ring-brand-teal/20">
                    <Icon name={step.icon} />
                  </div>
                  <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand-teal text-xs font-bold text-white">
                    {step.n}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-brand-navy">{step.title}</h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-500">{step.description}</p>

                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute right-[-1.75rem] top-7 hidden text-slate-300 sm:block"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                      <path
                        d="M5 12h14M13 6l6 6-6 6"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                )}
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Powerful Features */}
      <Section compact className="border-t border-slate-200">
        <Container>
          <div className="mb-12 text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-brand-gold-600">
              Powerful Features
            </span>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <FeatureCard
                key={feature.title}
                title={feature.title}
                description={feature.description}
                tone={feature.tone}
                icon={<Icon name={feature.icon} />}
              />
            ))}
          </div>
        </Container>
      </Section>

      {/* CTA strip */}
      <Section compact className="border-t border-slate-200 pb-20 md:pb-28">
        <Container>
          <div className="flex flex-col items-center gap-5 rounded-2xl bg-gradient-to-r from-brand-teal-100/70 to-brand-teal-100/30 p-8 text-center sm:flex-row sm:justify-between sm:p-10 sm:text-left">
            <div className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-brand-teal shadow-sm sm:flex"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                  <path
                    d="M5 15c-2-2-2-6 3-9 3 5 0 8-3 9Zm3-1 8-8c2-1 4 1 3 3l-8 8-3-3Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <div>
                <h3 className="text-xl font-semibold text-brand-navy sm:text-2xl">
                  Ready to explore a repository?
                </h3>
                <p className="mt-1 max-w-md text-sm text-slate-500 sm:text-base">
                  Start analyzing any GitHub repository and unlock its insights.
                </p>
              </div>
            </div>
            <Button href="/analyze" variant="brand" size="lg" className="w-full shrink-0 sm:w-auto">
              Analyze Your Repository
            </Button>
          </div>
        </Container>
      </Section>
    </div>
  );
}
