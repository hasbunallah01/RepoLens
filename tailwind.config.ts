import type { Config } from "tailwindcss";

/**
 * Tailwind config — RepoLens
 * -----------------------------------------------------------------------------
 * Brand color tokens live in `lib/brand/colors.ts` and are mirrored here as
 * the `brand.*` namespace. Those are the canonical brand colors extracted
 * from the official logo. Use `bg-brand-navy`, `text-brand-teal`, etc.
 *
 * The legacy `navy.*` and `emerald.*` scales are retained for backward
 * compatibility with components written before the brand system landed.
 * Prefer `brand.*` for any new code.
 */

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // -------------------------------------------------------------------------
        // Brand palette (source of truth: lib/brand/colors.ts)
        // -------------------------------------------------------------------------
        brand: {
          // PRIMARY — Deep Navy / Charcoal (headings, body copy)
          navy: {
            DEFAULT: "#0d1b2a",
            600: "#1f2a36",
            800: "#1a2532",
            900: "#101a24",
          },
          // SECONDARY — Teal / Emerald (buttons, links, icons)
          teal: {
            DEFAULT: "#0c8974",
            50: "#e9f8f5",
            100: "#d3efe7",
            600: "#0a7362",
            700: "#075e50",
          },
          // ACCENT — Warm Gold / Orange (badges, icon accents)
          gold: {
            DEFAULT: "#f1962a",
            50: "#fdf4e9",
            100: "#fcead1",
            600: "#d97f1a",
          },
          // Neutral grays for body copy on the light theme
          slate: {
            500: "#64748b",
            600: "#475569",
          },
        },
        // -------------------------------------------------------------------------
        // Legacy palettes (kept for backward compatibility — prefer `brand.*`)
        // -------------------------------------------------------------------------
        navy: {
          50: "#f0f4fa",
          100: "#dae4f2",
          200: "#b5c9e5",
          300: "#8ba8d3",
          400: "#5e83bc",
          500: "#3f64a3",
          600: "#314f87",
          700: "#283f6b",
          800: "#1d2d4d",
          900: "#0f1a2e",
          950: "#070d1a",
        },
        emerald: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "monospace"],
      },
      backgroundImage: {
        "light-gradient":
          "radial-gradient(ellipse at top, rgba(12,137,116,0.06), transparent 55%), linear-gradient(180deg, #ffffff 0%, #ffffff 100%)",
        "brand-gradient":
          "linear-gradient(135deg, #0c8974 0%, #f1962a 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
