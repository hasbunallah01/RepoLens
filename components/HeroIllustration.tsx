import Image from "next/image";
import { CodeIcon, FolderIcon, GitHubIcon, ShareIcon, SparkleIcon } from "./icons";

/**
 * Hero illustration: the RepoLens icon mark "standing" on a pedestal,
 * surrounded by floating chips that echo what the product touches
 * (GitHub, files, code, connections). Built from the real committed
 * icon asset plus lightweight CSS/SVG accents — no new artwork needed.
 */
export function HeroIllustration() {
  return (
    <div className="relative mx-auto flex h-[340px] w-full max-w-md items-center justify-center sm:h-[380px]">
      {/* ambient dashed orbit */}
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-full border border-dashed border-brand-teal/20"
      />

      {/* scattered sparkles */}
      <SparkleIcon className="absolute left-6 top-2 h-3 w-3 text-brand-gold/70" aria-hidden="true" />
      <SparkleIcon className="absolute right-10 top-10 h-2.5 w-2.5 text-brand-teal/50" aria-hidden="true" />
      <SparkleIcon className="absolute bottom-16 left-2 h-2.5 w-2.5 text-brand-teal/40" aria-hidden="true" />
      <SparkleIcon className="absolute bottom-8 right-4 h-3 w-3 text-brand-gold/60" aria-hidden="true" />

      {/* floating chips */}
      <div className="absolute left-4 top-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-md shadow-slate-200 ring-1 ring-slate-100">
        <GitHubIcon className="h-6 w-6 text-brand-navy" />
      </div>
      <div className="absolute right-2 top-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-md shadow-slate-200 ring-1 ring-slate-100">
        <FolderIcon className="h-6 w-6 text-brand-teal" />
      </div>
      <div className="absolute bottom-24 left-0 flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-md shadow-slate-200 ring-1 ring-slate-100">
        <CodeIcon className="h-5 w-5 text-brand-gold" />
      </div>
      <div className="absolute bottom-20 right-0 flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-md shadow-slate-200 ring-1 ring-slate-100">
        <ShareIcon className="h-5 w-5 text-brand-teal" />
      </div>

      {/* centerpiece mark */}
      <div className="relative z-10 flex flex-col items-center">
        <Image
          src="/assets/icon.png"
          alt="RepoLens"
          width={200}
          height={200}
          className="h-44 w-44 drop-shadow-xl sm:h-52 sm:w-52"
          priority
        />
        {/* pedestal */}
        <div className="-mt-3 h-4 w-56 rounded-full bg-slate-100 shadow-inner sm:w-64" />
        <div className="mt-1 h-1.5 w-40 rounded-full bg-brand-teal/20 blur-sm sm:w-48" />
      </div>
    </div>
  );
}
