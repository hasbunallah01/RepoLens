import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { AboutHero } from "@/components/about/AboutHero";
import { ProblemWeSolve } from "@/components/about/ProblemWeSolve";
import { HowRepoLensWorks } from "@/components/about/HowRepoLensWorks";
import { PoweredByParitok } from "@/components/about/PoweredByParitok";
import { TechnicalArchitecture } from "@/components/about/TechnicalArchitecture";
import { FeaturesGrid } from "@/components/about/FeaturesGrid";
import { WhyItMatters } from "@/components/about/WhyItMatters";
import { WhoItsFor } from "@/components/about/WhoItsFor";
import { HackathonBanner } from "@/components/about/HackathonBanner";
import { AboutFinalCTA } from "@/components/about/AboutFinalCTA";

export const metadata: Metadata = {
  title: "About",
  description:
    "RepoLens uses the power of Paritok to intelligently rank and retrieve the most relevant files, build optimal context, and help AI answer your questions accurately and efficiently.",
};

/**
 * /about — fully static. Every section is mock content/illustration;
 * nothing on this page makes a network request. See PR notes for what,
 * if anything, should eventually be backed by real data.
 */
export default function AboutPage() {
  return (
    <>
      <Section className="pt-10 pb-8 md:pt-14">
        <Container>
          <AboutHero />
        </Container>
      </Section>

      <Section compact className="pt-0">
        <Container>
          <ProblemWeSolve />
        </Container>
      </Section>

      <Section compact>
        <Container>
          <HowRepoLensWorks />
        </Container>
      </Section>

      <Section compact>
        <Container>
          <PoweredByParitok />
        </Container>
      </Section>

      <Section compact>
        <Container>
          <TechnicalArchitecture />
        </Container>
      </Section>

      <Section compact>
        <Container>
          <FeaturesGrid />
        </Container>
      </Section>

      <Section compact>
        <Container>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <WhyItMatters />
            <WhoItsFor />
          </div>
        </Container>
      </Section>

      <Section compact className="pt-0">
        <Container>
          <HackathonBanner />
        </Container>
      </Section>

      <Section compact>
        <Container>
          <AboutFinalCTA />
        </Container>
      </Section>
    </>
  );
}
