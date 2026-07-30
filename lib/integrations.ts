/**
 * Future-integration placeholders.
 *
 * Phase 1 only defines the surface area. Real implementations
 * (GitHub fetch, Paritok optimize, OpenAI chat) are deferred to later phases.
 */

import type { Feature } from "@/types";

/**
 * Returns the list of features displayed on the home page.
 * Kept as a function (not a constant) so it can later be driven
 * by config or feature flags without changing call sites.
 */
export function getHomeFeatures(): Feature[] {
  return [
    {
      title: "Analyze GitHub repositories",
      description:
        "Point RepoLens at any public GitHub repository and get a structured understanding of the codebase — files, modules, and key entry points.",
      icon: "search",
    },
    {
      title: "Ask AI questions",
      description:
        "Ask natural-language questions about a repo and get focused, grounded answers sourced from the actual code.",
      icon: "message",
    },
    {
      title: "Token Optimization with Paritok",
      description:
        "Every prompt is pre-processed through Paritok, retrieving only the relevant slices of code to keep token usage lean.",
      icon: "sparkles",
    },
    {
      title: "Prompt Analytics",
      description:
        "See exactly how many tokens each query would have used without optimization, and how much you saved with Paritok.",
      icon: "chart",
    },
  ];
}
