/**
 * Page header for /analyze — big title + supporting copy.
 */
export function AnalyzeHeader() {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h1 className="text-3xl font-extrabold tracking-tight text-brand-navy sm:text-4xl">
        Analyze a GitHub Repository
      </h1>
      <p className="mt-3 text-base text-slate-500">
        Enter a GitHub repository URL and let RepoLens analyze the codebase,
        understand the structure, and generate insights.
      </p>
    </div>
  );
}
