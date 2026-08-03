interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  eyebrowColor?: "teal" | "gold";
}

/**
 * Centered "EYEBROW" + title used to introduce each About page section.
 */
export function SectionHeading({ eyebrow, title, eyebrowColor = "teal" }: SectionHeadingProps) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p
        className={`text-xs font-semibold uppercase tracking-wide ${
          eyebrowColor === "gold" ? "text-brand-gold" : "text-brand-teal"
        }`}
      >
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-brand-navy sm:text-3xl">{title}</h2>
    </div>
  );
}
