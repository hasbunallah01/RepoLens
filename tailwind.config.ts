import type { Config } from "tailwindcss";

/**
 * Tailwind config — RepoLens (light theme redesign)
 * -----------------------------------------------------------------------------
 * Semantic tokens are backed by CSS variables defined in app/globals.css.
 * Brand tokens (navy / teal / gold) are the canonical colors from the logo.
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        // Brand palette (canonical)
        brand: {
          navy: {
            DEFAULT: "#263442",
            strong: "#1a2532",
          },
          teal: {
            DEFAULT: "#14977c",
            600: "#0f8068",
            50: "#ecf7f3",
          },
          gold: {
            DEFAULT: "#e0a74b",
            600: "#c8902f",
            50: "#fbf3e2",
          },
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: [
          "var(--font-jakarta)",
          "var(--font-inter)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.04), 0 8px 24px rgba(16, 24, 40, 0.06)",
        "card-hover":
          "0 4px 8px rgba(16, 24, 40, 0.06), 0 16px 40px rgba(16, 24, 40, 0.10)",
        soft: "0 1px 3px rgba(16, 24, 40, 0.06)",
        float: "0 10px 30px rgba(16, 24, 40, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
