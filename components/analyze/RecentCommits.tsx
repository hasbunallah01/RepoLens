import type { RepoCommit } from "@/types/repository";

interface RecentCommitsProps {
  commits: RepoCommit[];
}

/**
 * "Recent Commits" card. Not visible in the cropped reference screenshot,
 * but listed explicitly in the component spec — styled to match the other
 * result cards so it slots in cleanly.
 */
export function RecentCommits({ commits }: RecentCommitsProps) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100">
      <h3 className="text-sm font-bold text-brand-navy">Recent Commits</h3>
      <ul className="mt-4 space-y-3">
        {commits.map((commit) => (
          <li key={commit.sha}>
            <a
              href={commit.url}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-start gap-3 rounded-lg p-1.5 -m-1.5 transition-colors hover:bg-slate-50"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-teal-50 text-xs font-bold text-brand-teal">
                {commit.author.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-brand-navy">{commit.message}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {commit.author} · {relativeTime(commit.date)}
                </p>
              </div>
              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">
                {commit.sha.slice(0, 7)}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.round(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
