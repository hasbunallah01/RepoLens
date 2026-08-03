import { BarChartIcon, LightningIcon, SearchIcon, TargetIcon, TrophyIcon } from "@/components/icons";
import { HACKATHON_TAGS } from "@/lib/mock-about-data";

const TAG_ICONS = [LightningIcon, TargetIcon, SearchIcon, BarChartIcon];

/**
 * Understated hackathon attribution banner.
 */
export function HackathonBanner() {
  return (
    <div className="rounded-2xl border border-brand-gold/20 bg-brand-gold-50 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand-gold shadow-sm shadow-slate-200">
            <TrophyIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-gold-600">
              Built for the Build with Paritok Hackathon
            </p>
            <h3 className="mt-1 text-base font-bold text-brand-navy">
              RepoLens showcases the power of Paritok
            </h3>
            <p className="mt-0.5 text-sm text-slate-600">
              Demonstrating token-efficient, explainable, and intelligent retrieval for
              real-world AI applications.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2.5 sm:justify-end">
        {HACKATHON_TAGS.map((tag, i) => {
          const Icon = TAG_ICONS[i % TAG_ICONS.length] ?? LightningIcon;
          return (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-brand-navy shadow-sm shadow-slate-200"
            >
              <Icon className="h-3.5 w-3.5 text-brand-gold" />
              {tag}
            </span>
          );
        })}
      </div>
    </div>
  );
}
