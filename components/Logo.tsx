import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** Show the wordmark next to the mark. Defaults to true. */
  withWordmark?: boolean;
  /** Pixel size of the icon mark. */
  size?: number;
}

/**
 * RepoLens logo — uses the committed brand artwork (public/assets).
 * Renders the icon mark, optionally paired with the "RepoLens" wordmark.
 */
export function Logo({ className, withWordmark = true, size = 32 }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src="/assets/icon.png"
        alt="RepoLens"
        width={size}
        height={size}
        className="rounded-lg"
        priority
      />
      {withWordmark && (
        <span className="text-lg font-bold tracking-tight text-brand-navy">
          Repo<span className="text-brand-teal">Lens</span>
        </span>
      )}
    </span>
  );
}
