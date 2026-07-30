import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { Button } from "@/components/Button";

export const metadata: Metadata = {
  title: "About",
  description:
    "The vision behind RepoLens — a token-efficient way to understand any codebase, built for the Build with Paritok Hackathon.",
};

const PILLARS = [
  {
    title: "The problem",
    body:
      "Developers spend real money every time they hand an entire repository to an AI assistant. Most of those tokens are noise — files that have nothing to do with the question. Token efficiency isn't a nice-to-have; it's a budget line.",
  },
  {
    title: "Our approach",
    body:
      "RepoLens first analyzes the structure and intent of a repository, then retrieves only the slices of code that actually matter for a given question. The retrieved context is then routed through Paritok for token-level optimization before any model is called.",
  },
  {
    title: "Why Paritok",
    body:
      "Paritok is the core optimization layer of RepoLens, not an afterthought. By treating token efficiency as a first-class stage in the pipeline, we keep quality high while slashing the number of tokens that reach the model.",
  },
];

export default function AboutPage() {
  return (
    <>
      <Section className="pt-16 md:pt-24">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-navy-700 bg-navy-900/60 px-3 py-1 text-xs font-medium text-navy-100">
              About RepoLens
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
              A developer-first lens for any codebase.
            </h1>
            <p className="mt-6 text-base text-navy-200 sm:text-lg">
              RepoLens is being built for the{" "}
              <span className="font-medium text-emerald-400">
                Build with Paritok: The Token-Efficiency Hackathon
              </span>
              . Our mission is simple — make it cheap, fast, and pleasant to
              understand code, no matter how large the repository.
            </p>
          </div>
        </Container>
      </Section>

      <Section compact className="border-t border-navy-800/60">
        <Container>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {PILLARS.map((pillar) => (
              <article
                key={pillar.title}
                className="rounded-xl border border-navy-800/70 bg-navy-900/40 p-6"
              >
                <h2 className="text-lg font-semibold text-white">{pillar.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-navy-200">{pillar.body}</p>
              </article>
            ))}
          </div>
        </Container>
      </Section>

      <Section compact className="border-t border-navy-800/60">
        <Container>
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              The roadmap
            </h2>
            <p className="text-sm text-navy-200 sm:text-base">
              Phase 1 (now): scaffold and design system. Phase 2: GitHub
              ingestion + retrieval. Phase 3: Paritok integration + AI answers
              with prompt analytics.
            </p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <Button href="/" variant="secondary" size="lg">
                Back to home
              </Button>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
