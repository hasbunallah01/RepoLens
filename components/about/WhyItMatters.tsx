import { CheckCircleIcon } from "@/components/icons";
import { TOKEN_CHART, WHY_IT_MATTERS } from "@/lib/mock-about-data";

/**
 * "Why RepoLens Matters" — benefit bullets + a small illustrative bar
 * chart comparing token usage with and without RepoLens.
 *
 * The chart is a static illustration (fixed 100 vs 10 mock values), not a
 * measurement from any real repository or benchmark run.
 */
export function WhyItMatters() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm shadow-slate-100 sm:p-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal">Why It Matters</p>
          <h2 className="mt-2 text-xl font-extrabold text-brand-navy sm:text-2xl">
            Better context. Better answers. Lower cost.
          </h2>
          <ul className="mt-4 space-y-2.5">
            {WHY_IT_MATTERS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-teal" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <TokenChart />
      </div>
    </div>
  );
}

function TokenChart() {
  const maxHeight = 140;
  const withoutHeight = maxHeight;
  const withHeight = Math.max(12, (TOKEN_CHART.withValue / TOKEN_CHART.withoutValue) * maxHeight);

  return (
    <div className="flex items-center justify-center gap-8 rounded-xl border border-slate-100 bg-slate-50/60 p-6">
      <div className="flex items-end gap-6" style={{ height: maxHeight }}>
        <div className="flex flex-col items-center gap-2">
          <div
            className="w-10 rounded-t-md bg-slate-300"
            style={{ height: withoutHeight }}
            aria-hidden="true"
          />
          <span className="text-[11px] text-slate-500">{TOKEN_CHART.withoutLabel}</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div
            className="w-10 rounded-t-md bg-brand-teal"
            style={{ height: withHeight }}
            aria-hidden="true"
          />
          <span className="text-[11px] text-slate-500">{TOKEN_CHART.withLabel}</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-3xl font-extrabold text-brand-teal">{TOKEN_CHART.reductionLabel}</p>
        <p className="text-xs text-slate-500">{TOKEN_CHART.reductionSublabel}</p>
      </div>
    </div>
  );
}
