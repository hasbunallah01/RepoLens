import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { Hero } from "@/components/Hero";
import { FeatureCard } from "@/components/FeatureCard";
import { Button } from "@/components/Button";
import type { Feature } from "@/types";

export const metadata: Metadata = {
  title: "RepoLens — Understand any codebase with fewer tokens",
  description:
    "Token-efficient codebase understanding, powered by Paritok. Built for the Build with Paritok Hackathon.",
};

const FEATURES: Feature[] = [
  {
    title: "Analyze GitHub repositories",
    description:
      "Point RepoLens at any public GitHub repository and get a structured understanding of the codebase — files, modules, and key entry points.",
    icon: "search",
  },
  {
    title: "Ask AI questions",
    description:
      "Ask natural-language questions about a repo and get focused, grounded answers sourced from the actual code.",
    icon: "message",
  },
  {
    title: "Token Optimization with Paritok",
    description:
      "Every prompt is pre-processed through Paritok, retrieving only the relevant slices of code to keep token usage lean.",
    icon: "sparkles",
  },
  {
    title: "Prompt Analytics",
    description:
      "See exactly how many tokens each query would have used without optimization, and how much you saved with Paritok.",
    icon: "chart",
  },
];

function FeatureIcon({ name }: { name: Feature["icon"] }) {
  // Tiny inline icon set so we don't add a new dependency in Phase 1.
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
  }
}

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <Section className="pt-16 md:pt-24">
        <Container>
          <Hero />
        </Container>
      </Section>

      {/* Features */}
      <Section compact className="border-t border-navy-800/60">
        <Container>
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Everything you need to grok a codebase — fast
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-navy-200 sm:text-base">
              RepoLens combines smart repository analysis, AI Q&amp;A, and
              Paritok-powered token optimization into one developer-first tool.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <FeatureCard
                key={feature.title}
                title={feature.title}
                description={feature.description}
                icon={<FeatureIcon name={feature.icon} />}
              />
            ))}
          </div>
        </Container>
      </Section>

      {/* CTA strip */}
      <Section compact className="border-t border-navy-800/60">
        <Container>
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-navy-800/70 bg-navy-900/40 p-8 text-center sm:p-12">
            <h3 className="text-xl font-semibold text-white sm:text-2xl">
              Ready to look at code differently?
            </h3>
            <p className="max-w-xl text-sm text-navy-200 sm:text-base">
              The full analysis experience is coming in the next phases. For
              now, take a look at the project vision and the planned roadmap.
            </p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <Button href="/about" size="lg">
                Read the vision
              </Button>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
