/**
 * Skeleton placeholders shown while /api/analyze is in flight.
 * Mirrors the layout of the real result sections.
 */
export function ResultSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="rounded-2xl border border-navy-800/70 bg-navy-900/40 p-6 sm:p-8">
        <div className="h-5 w-40 animate-pulse rounded bg-navy-800" />
        <div className="mt-5 h-8 w-72 animate-pulse rounded bg-navy-800" />
        <div className="mt-3 h-4 w-full max-w-2xl animate-pulse rounded bg-navy-800/80" />
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-navy-800/70" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-navy-900/40" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-xl bg-navy-900/40" />
      <div className="h-64 animate-pulse rounded-xl bg-navy-900/40" />
    </div>
  );
}
