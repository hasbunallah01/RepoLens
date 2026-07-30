import type { RepoCommit, RepoIndex, RepoMetadata } from "@/types/repository";

interface StatsGridProps {
  metadata: RepoMetadata;
  index: RepoIndex;
  commits: RepoCommit[];
}

/**
 * Dashboard-style cards: totals, README, license, size, recent commits.
 */
export function StatsGrid({ metadata, index, commits }: StatsGridProps) {
  const cards: { title: string; value: string; sub?: string }[] = [
    {
      title: "Total Files",
      value: index.totalFiles.toLocaleString(),
      sub: `${index.rootFolders.length} top-level folder${index.rootFolders.length === 1 ? "" : "s"}`,
    },
    {
      title: "Repository Size",
      value: formatBytes(index.totalSizeBytes),
      sub: `${metadata.sizeKb.toLocaleString()} KB reported by GitHub`,
    },
    {
      title: "README",
      value: index.hasReadme ? "Present" : "Missing",
      sub: index.hasReadme ? "Found at the root" : "No README in the index",
    },
    {
      title: "License",
      value: metadata.license ?? "None",
      sub: metadata.license ? "Detected via GitHub" : "No license file detected",
    },
  ];

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.title}
            className="rounded-xl border border-navy-800/70 bg-navy-900/40 p-5"
          >
            <p className="text-xs uppercase tracking-wide text-navy-400">{c.title}</p>
            <p className="mt-2 text-xl font-semibold text-white">{c.value}</p>
            {c.sub ? <p className="mt-1 text-xs text-navy-300">{c.sub}</p> : null}
          </div>
        ))}
      </div>

      <RecentCommits commits={commits} />
    </section>
  );
}

function RecentCommits({ commits }: { commits: RepoCommit[] }) {
  if (commits.length === 0) {
    return (
      <div className="rounded-xl border border-navy-800/70 bg-navy-900/40 p-5 text-sm text-navy-300">
        Recent commits couldn&apos;t be loaded right now.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-navy-800/70 bg-navy-900/40 p-5">
      <h3 className="mb-3 text-sm font-semibold text-white">Recent commits</h3>
      <ul className="divide-y divide-navy-800/70">
        {commits.map((c) => (
          <li key={c.sha} className="py-2.5">
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 hover:text-white"
            >
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-800 text-[10px] font-mono text-navy-200">
                {c.sha.slice(0, 2)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-navy-100 group-hover:text-emerald-300">
                  {firstLine(c.message)}
                </span>
                <span className="mt-0.5 block text-xs text-navy-400">
                  {c.author} · {formatRelative(c.date)} ·{" "}
                  <span className="font-mono">{c.sha.slice(0, 7)}</span>
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function firstLine(s: string): string {
  return s.split("\n")[0] ?? s;
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let value = n;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatRelative(iso: string): string {
  try {
    const d = new Date(iso).getTime();
    const diff = Date.now() - d;
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day}d ago`;
    const month = Math.floor(day / 30);
    if (month < 12) return `${month}mo ago`;
    const year = Math.floor(day / 365);
    return `${year}y ago`;
  } catch {
    return iso;
  }
}
