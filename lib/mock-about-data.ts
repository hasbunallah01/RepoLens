/**
 * Static content for the About page. Everything here is copy/illustration
 * data only — there is no backend, no API, and nothing on this page makes
 * a network request.
 */

export const WITHOUT_REPOLENS: string[] = [
  "AI receives thousands of unnecessary files",
  "High token usage and cost",
  "Slower responses",
  "Context pollution and noise",
  "Lower accuracy",
];

export const WITH_REPOLENS: string[] = [
  "Intelligent repository understanding",
  "Only relevant files and code",
  "Lower token cost",
  "Faster, more accurate answers",
  "Clean, focused context",
];

export interface WorkflowStep {
  step: number;
  title: string;
  description: string;
  icon: "github" | "search" | "database" | "target" | "file" | "chat";
}

export const WORKFLOW_STEPS: WorkflowStep[] = [
  { step: 1, title: "GitHub Repository", description: "Connect any public or private repository.", icon: "github" },
  { step: 2, title: "Analyze Structure", description: "We analyze the repository structure, files, and metadata.", icon: "search" },
  { step: 3, title: "Index Files", description: "Files are parsed, chunked, and indexed locally.", icon: "database" },
  { step: 4, title: "Rank Relevant Files", description: "Paritok ranks files using deterministic signals and scores.", icon: "target" },
  { step: 5, title: "Build Context", description: "Top relevant files are assembled into optimal context.", icon: "file" },
  { step: 6, title: "Ask Questions", description: "Ask anything and get accurate AI answers.", icon: "chat" },
];

export const PARITOK_CHECKLIST: string[] = [
  "Token-efficient retrieval",
  "Local and private by design",
  "Smart file ranking with transparent scores",
  "Explainable results you can trust",
  "Deterministic, fast, and reliable",
];

export const PARITOK_NODES: string[] = [
  "Token Efficiency",
  "Smart Ranking",
  "Explainability",
  "Local & Private",
  "Deterministic Retrieval",
];

export interface ArchitectureNode {
  label: string;
  icon: "github" | "file" | "database" | "paritok" | "layers" | "cpu" | "chat";
}

export const ARCHITECTURE_PIPELINE: ArchitectureNode[] = [
  { label: "GitHub Repository", icon: "github" },
  { label: "Repository Metadata", icon: "file" },
  { label: "Repository Index", icon: "database" },
  { label: "Ranking Engine (Paritok)", icon: "paritok" },
  { label: "Context Builder", icon: "layers" },
  { label: "LLM (Any Model)", icon: "cpu" },
  { label: "Answer", icon: "chat" },
];

export interface FeatureItem {
  title: string;
  description: string;
  icon: "folder" | "target" | "chart" | "chat" | "pie" | "lightning" | "tree" | "clock";
}

export const KEY_FEATURES: FeatureItem[] = [
  { title: "Repository Analysis", description: "Deep analysis of structure, metadata, languages, and statistics.", icon: "folder" },
  { title: "Intelligent Ranking", description: "Paritok ranks files by relevance using transparent and deterministic signals.", icon: "target" },
  { title: "Explainable Retrieval", description: "See why files were selected with clear scores and explanations.", icon: "chart" },
  { title: "AI Q&A", description: "Ask natural language questions and get precise, grounded answers.", icon: "chat" },
  { title: "Language Statistics", description: "Visualize languages, lines of code, and file distributions.", icon: "pie" },
  { title: "Context Optimization", description: "Build optimal context with the most relevant files to save tokens.", icon: "lightning" },
  { title: "File Tree Explorer", description: "Explore the repository structure with an interactive file tree.", icon: "tree" },
  { title: "Commit Insights", description: "Browse recent commits and understand project history.", icon: "clock" },
];

export const WHY_IT_MATTERS: string[] = [
  "Reduce AI token usage by up to 90%",
  "Get faster, more accurate answers",
  "Eliminate noise and irrelevant files",
  "Keep your codebase private and secure",
  "Scale to any repository size",
];

/** Illustrative only — not measured from any real repo or benchmark. */
export const TOKEN_CHART = {
  withoutLabel: "Without RepoLens",
  withLabel: "With RepoLens",
  withoutValue: 100,
  withValue: 10,
  reductionLabel: "90%",
  reductionSublabel: "Token Reduction",
};

export interface AudienceCard {
  title: string;
  description: string;
  icon: "code" | "users" | "robot";
}

export const AUDIENCE: AudienceCard[] = [
  { title: "Developers", description: "Understand unfamiliar codebases quickly and confidently.", icon: "code" },
  { title: "Open Source Maintainers", description: "Onboard contributors and review code more efficiently.", icon: "users" },
  { title: "AI Coding Assistants", description: "Give AI the right context for better coding help.", icon: "robot" },
];

export const HACKATHON_TAGS: string[] = [
  "Token Efficiency",
  "Context Optimization",
  "Repository Intelligence",
  "Explainable Retrieval",
];
