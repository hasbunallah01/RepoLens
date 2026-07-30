import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep navy palette
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
        // Emerald accent
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
        "navy-gradient":
          "radial-gradient(ellipse at top, rgba(16,185,129,0.08), transparent 60%), linear-gradient(180deg, #0f1a2e 0%, #070d1a 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
