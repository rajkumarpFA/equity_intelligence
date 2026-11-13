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
        // Voltagent Design Tokens
        "bg-base": "var(--bg-base)",
        "bg-card": "var(--bg-card)",
        "bg-elevated": "var(--bg-elevated)",
        "bg-input": "var(--bg-input)",
        border: "var(--border)",
        hairline: "var(--hairline)",
        "hairline-soft": "var(--hairline-soft)",
        accent: "var(--accent)",
        "accent-soft": "var(--accent-soft)",
        "accent-deep": "var(--accent-deep)",
        "on-accent": "var(--on-accent)",
        "accent-2": "var(--accent-2)",
        "neutral-series": "var(--neutral-series)",
        up: "var(--up)",
        down: "var(--down)",
        warn: "var(--warn)",
        info: "var(--info)",
        "text-1": "var(--text-1)",
        "text-2": "var(--text-2)",
        "text-3": "var(--text-3)",
        // Voltagent Primitive Names
        primary: "#00d992",
        "primary-soft": "#2fd6a1",
        "primary-deep": "#10b981",
        "on-primary": "#101010",
        canvas: "#101010",
        "canvas-soft": "#1a1a1a",
        ink: "#f2f2f2",
        "ink-strong": "#ffffff",
        body: "#bdbdbd",
        mute: "#8b949e",
      },
      borderRadius: {
        card: "8px",
        input: "6px",
        pill: "9999px",
        sm: "6px",
        md: "8px",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: [
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
