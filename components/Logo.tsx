import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** Show the wordmark next to the mark. Defaults to true. */
  withWordmark?: boolean;
  /** Pixel size of the square mark. */
  size?: number;
  /** Wrap in a link to home. Defaults to true. */
  href?: string | null;
}

/**
 * RepoLens logo — the official 3D "R" magnifier mark plus the
 * "RepoLens" wordmark (Repo = navy, Lens = teal).
 */
export function Logo({
  className,
  withWordmark = true,
  size = 32,
  href = "/",
}: LogoProps) {
  const content = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src="/assets/repolens-mark.png"
        alt="RepoLens"
        width={size}
        height={size}
        priority
        className="h-auto w-auto"
        style={{ width: size, height: size }}
      />
      {withWordmark && (
        <span className="font-display text-lg font-extrabold tracking-tight text-brand-navy">
          Repo<span className="text-brand-teal">Lens</span>
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} aria-label="RepoLens home" className="inline-flex">
        {content}
      </Link>
    );
  }
  return content;
}
