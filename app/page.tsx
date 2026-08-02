import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { Features } from "@/components/Features";
import { CTASection } from "@/components/CTASection";

export const metadata: Metadata = {
  title: "RepoLens – Understand Any GitHub Repository",
  description:
    "RepoLens analyzes repositories, builds intelligent context, and answers natural-language questions about the codebase.",
};

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <Section className="pt-10 pb-8 md:pt-16">
        <Container>
          <Hero />
        </Container>
      </Section>

      {/* How It Works */}
      <Section compact className="pt-0">
        <HowItWorks />
      </Section>

      {/* Powerful Features */}
      <Section compact className="pt-4">
        <Features />
      </Section>

      {/* CTA strip */}
      <Section compact>
        <CTASection />
      </Section>
    </>
  );
}
