/**
 * RepoLens — Brand Color System
 * -----------------------------------------------------------------------------
 * Source of truth for all brand colors used across the application.
 *
 * These three colors were extracted directly from the official RepoLens logo
 * (primary lockup) and are the *only* brand colors the product may use.
 *
 *   PRIMARY   — Deep Navy / Charcoal  (the R + "Repo" wordmark)
 *   SECONDARY — Teal / Emerald        (the lens + "Lens" wordmark)
 *   ACCENT    — Warm Gold / Orange    (the speed lines)
 *
 * Anything else (greys, white, near-black, glass overlays) is a neutral and
 * is derived from these colors; new brand hues must not be invented.
 *
 * The same values are mirrored in `tailwind.config.ts` under
 * `theme.extend.colors.brand.*` so they can be used as Tailwind utility
 * classes (e.g. `bg-brand-navy`, `text-brand-teal`, `border-brand-gold`).
 */

export const brandColors = {
  /** PRIMARY — Deep Navy / Charcoal */
  navy: {
    /** Canonical brand navy, sampled from the core of the "R" mark. */
    DEFAULT: "#263442",
    /** Slightly lighter for hover/elevation. */
    600: "#1f2a36",
    /** Darker, for deep backgrounds. */
    800: "#1a2532",
    900: "#101a24",
  },

  /** SECONDARY — Teal / Emerald */
  teal: {
    /** Canonical brand teal, sampled from the saturated lens handle. */
    DEFAULT: "#14977c",
    /** Hover/active. */
    600: "#0f8068",
    /** Soft tint for backgrounds / hovers. */
    100: "#d3efe7",
  },

  /** ACCENT — Warm Gold / Orange */
  gold: {
    /** Canonical brand gold, sampled from the speed lines. */
    DEFAULT: "#e0a74b",
    /** Hover/active. */
    600: "#c8902f",
    /** Soft tint for backgrounds. */
    100: "#fbeed3",
  },
} as const;

/**
 * Convenience accessors for the three core brand colors.
 * Use these in components, gradients, and analytics theming.
 */
export const brand = {
  primary: brandColors.navy.DEFAULT,
  secondary: brandColors.teal.DEFAULT,
  accent: brandColors.gold.DEFAULT,
} as const;

export type BrandColorKey = keyof typeof brand;
export default brand;
