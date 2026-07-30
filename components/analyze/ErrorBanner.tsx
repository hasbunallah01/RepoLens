import type { AnalysisError } from "@/types/repository";

interface ErrorBannerProps {
  error: AnalysisError;
}

/** Friendly mapping from code → headline. */
function headline(code: AnalysisError["code"]): string {
  switch (code) {
    case "INVALID_URL":
      return "That URL doesn't look right";
    case "REPO_NOT_FOUND":
      return "Repository not found";
    case "REPO_PRIVATE":
      return "This repository is private";
    case "RATE_LIMITED":
      return "GitHub rate limit reached";
    case "NETWORK":
      return "Network error";
    case "UNKNOWN":
    default:
      return "Something went wrong";
  }
}

export function ErrorBanner({ error }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-100"
    >
      <p className="font-semibold text-red-200">{headline(error.code)}</p>
      <p className="mt-1 text-red-100/90">{error.message}</p>
      {error.code === "RATE_LIMITED" ? (
        <p className="mt-3 text-xs text-red-100/80">
          Tip: add a <code className="font-mono">GITHUB_TOKEN</code> to a local
          <code className="font-mono"> .env.local</code> file. The token needs
          <code className="font-mono"> public_repo</code> scope.
        </p>
      ) : null}
    </div>
  );
}
