import { Button } from "./Button";
import { Container } from "./Container";
import { RocketIcon, SparkleIcon } from "./icons";

/**
 * Full-width mint CTA strip: rocket illustration, heading + copy, button.
 */
export function CTASection() {
  return (
    <Container>
      <div className="flex flex-col items-center gap-6 rounded-2xl bg-brand-teal-50 p-8 sm:flex-row sm:justify-between sm:p-10">
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
          <div className="relative flex h-16 w-20 shrink-0 items-center justify-center">
            <SparkleIcon className="absolute left-0 top-0 h-3 w-3 text-brand-gold/70" aria-hidden="true" />
            <div className="absolute bottom-0 h-8 w-16 rounded-full bg-white/70 blur-[2px]" aria-hidden="true" />
            <RocketIcon className="relative h-10 w-10 -rotate-45 text-brand-teal" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-brand-navy sm:text-2xl">
              Ready to explore a repository?
            </h3>
            <p className="mt-1 text-sm text-slate-600 sm:text-base">
              Start analyzing any GitHub repository and unlock its insights.
            </p>
          </div>
        </div>
        <Button href="/analyze" size="lg" className="w-full shrink-0 sm:w-auto">
          <RocketIcon className="h-4 w-4" />
          Analyze Your Repository
        </Button>
      </div>
    </Container>
  );
}
