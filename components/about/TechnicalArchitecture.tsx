import {
  ChatIcon,
  CpuIcon,
  DatabaseIcon,
  FileIcon,
  GitHubIcon,
  LayersIcon,
} from "@/components/icons";
import { SectionHeading } from "./SectionHeading";
import { ARCHITECTURE_PIPELINE, type ArchitectureNode } from "@/lib/mock-about-data";

const ICONS: Record<ArchitectureNode["icon"], React.ReactNode> = {
  github: <GitHubIcon className="h-5 w-5" />,
  file: <FileIcon className="h-5 w-5" />,
  database: <DatabaseIcon className="h-5 w-5" />,
  paritok: <span className="text-sm font-extrabold">P</span>,
  layers: <LayersIcon className="h-5 w-5" />,
  cpu: <CpuIcon className="h-5 w-5" />,
  chat: <ChatIcon className="h-5 w-5" />,
};

/**
 * "Technical Architecture" — the retrieval pipeline from repository to answer.
 */
export function TechnicalArchitecture() {
  return (
    <div>
      <SectionHeading eyebrow="Technical Architecture" title="Built for speed, accuracy, and efficiency" />

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:flex-nowrap sm:justify-between sm:gap-2">
        {ARCHITECTURE_PIPELINE.map((node, i) => (
          <div key={node.label} className="flex items-center gap-2">
            <div className="flex w-20 flex-col items-center gap-1.5 rounded-xl border border-slate-100 bg-white px-2 py-3 text-center shadow-sm shadow-slate-100 sm:w-24">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-teal-50 text-brand-teal">
                {ICONS[node.icon]}
              </span>
              <span className="text-[11px] font-semibold leading-tight text-brand-navy">{node.label}</span>
            </div>
            {i < ARCHITECTURE_PIPELINE.length - 1 ? (
              <span className="shrink-0 text-slate-300">→</span>
            ) : null}
          </div>
        ))}
      </div>

      <p className="mt-4 text-center text-xs text-slate-400">Explainable Scores &amp; Signals</p>
    </div>
  );
}
