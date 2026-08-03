import { CodeIcon, RobotIcon, UsersIcon } from "@/components/icons";
import { AUDIENCE, type AudienceCard } from "@/lib/mock-about-data";

const ICONS: Record<AudienceCard["icon"], React.ReactNode> = {
  code: <CodeIcon className="h-5 w-5" />,
  users: <UsersIcon className="h-5 w-5" />,
  robot: <RobotIcon className="h-5 w-5" />,
};

/**
 * "Who is RepoLens for?" — the three audience cards.
 */
export function WhoItsFor() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm shadow-slate-100 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold">Built For</p>
      <h2 className="mt-2 text-xl font-extrabold text-brand-navy sm:text-2xl">Who is RepoLens for?</h2>

      <div className="mt-5 space-y-4">
        {AUDIENCE.map((item) => (
          <div key={item.title} className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-teal-50 text-brand-teal">
              {ICONS[item.icon]}
            </span>
            <div>
              <h3 className="text-sm font-bold text-brand-navy">{item.title}</h3>
              <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
