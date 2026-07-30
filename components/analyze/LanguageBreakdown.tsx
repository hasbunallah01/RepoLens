import type { LanguageStat } from "@/types/repository";

interface LanguageBreakdownProps {
  languages: LanguageStat[];
}

/** CSS variable → colour per language. Falls back to neutral. */
const COLOURS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Go: "#00ADD8",
  Rust: "#dea584",
  Java: "#b07219",
  Kotlin: "#A97BFF",
  Swift: "#F05138",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  Ruby: "#701516",
  PHP: "#4F5D95",
  HTML: "#e34c26",
  CSS: "#563d7c",
  SCSS: "#c6538c",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Shell: "#89e051",
  Markdown: "#083fa1",
};

function colourFor(lang: string): string {
  return COLOURS[lang] ?? "#64748b";
}

export function LanguageBreakdown({ languages }: LanguageBreakdownProps) {
  if (languages.length === 0) {
    return (
      <div className="rounded-xl border border-navy-800/70 bg-navy-900/40 p-5 text-sm text-navy-300">
        No source files were indexed, so no language breakdown is available.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-navy-800/70 bg-navy-900/40 p-5">
      <h3 className="mb-4 text-sm font-semibold text-white">Language Breakdown</h3>

      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-navy-800"
        aria-hidden="true"
      >
        {languages.map((l) => (
          <span
            key={l.language}
            style={{ width: `${l.percent}%`, background: colourFor(l.language) }}
            title={`${l.language} · ${l.percent}%`}
          />
        ))}
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {languages.map((l) => (
          <li key={l.language} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-navy-100">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: colourFor(l.language) }}
                aria-hidden="true"
              />
              {l.language}
            </span>
            <span className="font-mono text-xs text-navy-300">
              {l.percent.toFixed(1)}% · {l.files} file{l.files === 1 ? "" : "s"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
