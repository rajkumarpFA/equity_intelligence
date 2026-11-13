import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--bg-base)",
        foreground: "var(--text-1)",
        // Strict Design Tokens from equity-intelligence-ui spec
        "bg-base": "var(--bg-base)",
        "bg-card": "var(--bg-card)",
        "bg-elevated": "var(--bg-elevated)",
        "bg-input": "var(--bg-input)",
        border: "var(--border)",
        accent: "var(--accent)",
        "accent-2": "var(--accent-2)",
        "neutral-series": "var(--neutral-series)",
        up: "var(--up)",
        down: "var(--down)",
        warn: "var(--warn)",
        info: "var(--info)",
        "text-1": "var(--text-1)",
        "text-2": "var(--text-2)",
        "text-3": "var(--text-3)",
        // Sambucus & Brand tokens
        sambucus: {
          50: "#f0f4fc",
          100: "#d9e3f7",
          900: "#101828", // Sambucus card
          950: "#0B1220", // Base app background
        },
      },
      borderRadius: {
        card: "16px",
        input: "8px",
        pill: "999px",
      },
      fontFamily: {
        sans: ["Roobert", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
