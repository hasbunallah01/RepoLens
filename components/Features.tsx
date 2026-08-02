import { Container } from "./Container";
import { FeatureCard } from "./FeatureCard";
import type { Feature } from "@/types";
import {
  FolderIcon,
  GlobeIcon,
  LayersIcon,
  LightningIcon,
  RobotIcon,
  SearchIcon,
} from "./icons";

const FEATURES: Feature[] = [
  {
    title: "Fast Analysis",
    description: "Analyze repositories in seconds with our optimized engine.",
    icon: "lightning",
  },
  {
    title: "AI-Powered Answers",
    description: "Get accurate, context-aware answers to your questions.",
    icon: "robot",
  },
  {
    title: "Smart File Ranking",
    description: "We rank and select the most relevant files for better answers.",
    icon: "folder",
  },
  {
    title: "Architecture Insights",
    description: "Understand the overall structure and design patterns.",
    icon: "layers",
  },
  {
    title: "Context-Aware Search",
    description: "Search and explore with deep understanding of the codebase.",
    icon: "search",
  },
  {
    title: "Public Repos Only",
    description: "Works with any public GitHub repository instantly.",
    icon: "globe",
  },
];

const ICON_STYLE: Record<Feature["icon"], { icon: React.ReactNode; color: "teal" | "gold" }> = {
  lightning: { icon: <LightningIcon className="h-6 w-6" />, color: "gold" },
  robot: { icon: <RobotIcon className="h-6 w-6" />, color: "teal" },
  folder: { icon: <FolderIcon className="h-6 w-6" />, color: "gold" },
  layers: { icon: <LayersIcon className="h-6 w-6" />, color: "teal" },
  search: { icon: <SearchIcon className="h-6 w-6" />, color: "gold" },
  globe: { icon: <GlobeIcon className="h-6 w-6" />, color: "teal" },
  message: { icon: <RobotIcon className="h-6 w-6" />, color: "teal" },
  sparkles: { icon: <LightningIcon className="h-6 w-6" />, color: "gold" },
  chart: { icon: <LayersIcon className="h-6 w-6" />, color: "teal" },
};

/**
 * "Powerful Features" — six-item grid, borderless cards, centered text.
 */
export function Features() {
  return (
    <Container>
      <p className="text-center text-sm font-semibold uppercase tracking-wide text-brand-gold">
        Powerful Features
      </p>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {FEATURES.map((feature) => {
          const style = ICON_STYLE[feature.icon];
          return (
            <FeatureCard
              key={feature.title}
              title={feature.title}
              description={feature.description}
              icon={style.icon}
              accent={style.color}
            />
          );
        })}
      </div>
    </Container>
  );
}
