import { BarChartIcon, ChevronRightIcon } from "@/components/icons";
import { LANGUAGE_COLORS } from "@/lib/mock-analyze-data";
import type { LanguageStat } from "@/types/repository";

interface LanguageChartProps {
  languages: LanguageStat[];
  onViewStatistics?: () => void;
}

const RADIUS = 42;
const STROKE = 16;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * "Language Breakdown" card — SVG donut chart + legend + CTA link.
 */
export function LanguageChart({ languages, onViewStatistics }: LanguageChartProps) {
  let cumulative = 0;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100">
      <h3 className="text-sm font-bold text-brand-navy">Language Breakdown</h3>

      <div className="mt-4 flex flex-1 flex-col items-center gap-5 sm:flex-row">
        <svg viewBox="0 0 100 100" className="h-32 w-32 shrink-0 -rotate-90">
          {languages.map((lang) => {
            const dash = (lang.percent / 100) * CIRCUMFERENCE;
            const offset = (cumulative / 100) * CIRCUMFERENCE;
            cumulative += lang.percent;
            return (
              <circle
                key={lang.language}
                cx="50"
                cy="50"
                r={RADIUS}
                fill="none"
                stroke={LANGUAGE_COLORS[lang.language] ?? "#cbd5e1"}
                strokeWidth={STROKE}
                strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                strokeDashoffset={-offset}
              />
            );
          })}
        </svg>

        <ul className="w-full flex-1 space-y-2">
          {languages.map((lang) => (
            <li key={lang.language} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-brand-navy">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: LANGUAGE_COLORS[lang.language] ?? "#cbd5e1" }}
                />
                {lang.language}
              </span>
              <span className="font-medium text-slate-500">{lang.percent.toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={onViewStatistics}
        className="mt-4 flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm font-medium text-brand-navy transition-colors hover:border-brand-teal/40 hover:bg-brand-teal-50"
      >
        <span className="flex items-center gap-2">
          <BarChartIcon className="h-4 w-4 text-brand-teal" />
          View Language Statistics
        </span>
        <ChevronRightIcon className="h-4 w-4 text-slate-400" />
      </button>
    </div>
  );
}
