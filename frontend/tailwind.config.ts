import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#030308",
        surface: "#0a0b14",
        "surface-raised": "#0f1020",
        border: "#1a1d35",
        "border-glow": "#6366f180",
        "text-primary": "#f0f0ff",
        "text-secondary": "#a0a0c0",
        "text-muted": "#606080",
        accent: {
          DEFAULT: "#ff4d6d",
          hover: "#ff1f56",
          dim: "#ff4d6d15",
        },
        clout: {
          DEFAULT: "#a78bfa",
          hover: "#8b5cf6",
          dim: "#a78bfa15",
        },
        neon: {
          purple: "#9d4edd",
          pink: "#f472b6",
          blue: "#60a5fa",
          cyan: "#22d3ee",
          green: "#00e5a0",
        },
        danger: "#ff4d6d",
        warning: "#fbbf24",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "gradient-neuro": "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
        "gradient-glow": "linear-gradient(135deg, #9d4edd22, #f472b622)",
        "gradient-card": "linear-gradient(135deg, #0f1020, #151728)",
      },
      boxShadow: {
        "neon-purple": "0 0 20px #9d4edd40, 0 0 40px #9d4edd10",
        "neon-pink": "0 0 20px #f472b640, 0 0 40px #f472b610",
        "neon-green": "0 0 20px #00e5a040, 0 0 40px #00e5a010",
        "neon-blue": "0 0 20px #60a5fa40, 0 0 40px #60a5fa10",
        "card-glow": "0 4px 24px #6366f108, 0 0 0 1px #6366f120",
        "card-hover": "0 8px 32px #9d4edd20, 0 0 0 1px #9d4edd30",
      },
      animation: {
        "ticker-scroll": "ticker 20s linear infinite",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow-pulse": "glowPulse 2s ease-in-out infinite alternate",
        "float": "float 6s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "border-glow": "borderGlow 3s ease-in-out infinite alternate",
        "slide-up": "slideUp 0.3s ease-out",
        "fade-in": "fadeIn 0.2s ease-out",
      },
      keyframes: {
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        glowPulse: {
          "0%": { boxShadow: "0 0 10px #9d4edd30" },
          "100%": { boxShadow: "0 0 30px #9d4edd60, 0 0 60px #9d4edd20" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        borderGlow: {
          "0%": { borderColor: "#9d4edd40" },
          "100%": { borderColor: "#f472b640" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
  darkMode: "class",
};

export default config;
