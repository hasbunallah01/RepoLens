import {
  BarChartIcon,
  ChatIcon,
  ClockIcon,
  FolderIcon,
  LightningIcon,
  PieChartIcon,
  TargetIcon,
} from "@/components/icons";
import { SectionHeading } from "./SectionHeading";
import { KEY_FEATURES, type FeatureItem } from "@/lib/mock-about-data";

const ICONS: Record<FeatureItem["icon"], React.ReactNode> = {
  folder: <FolderIcon className="h-5 w-5" />,
  target: <TargetIcon className="h-5 w-5" />,
  chart: <BarChartIcon className="h-5 w-5" />,
  chat: <ChatIcon className="h-5 w-5" />,
  pie: <PieChartIcon className="h-5 w-5" />,
  lightning: <LightningIcon className="h-5 w-5" />,
  tree: <FolderIcon className="h-5 w-5" />,
  clock: <ClockIcon className="h-5 w-5" />,
};

const ACCENTS: FeatureItem["icon"][] = ["target", "lightning", "chart"];

/**
 * "Key Features" — the eight capability cards.
 */
export function FeaturesGrid() {
  return (
    <div>
      <SectionHeading eyebrow="Key Features" title="Everything you need to understand any repository" eyebrowColor="gold" />

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {KEY_FEATURES.map((feature) => {
          const isGold = ACCENTS.includes(feature.icon);
          return (
            <div
              key={feature.title}
              className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm shadow-slate-100"
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  isGold ? "bg-brand-gold-50 text-brand-gold" : "bg-brand-teal-50 text-brand-teal"
                }`}
              >
                {ICONS[feature.icon]}
              </span>
              <h3 className="mt-3 text-sm font-bold text-brand-navy">{feature.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{feature.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
