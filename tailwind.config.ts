import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        grey: {
          50: "rgb(var(--grey-50) / <alpha-value>)",
          100: "rgb(var(--grey-100) / <alpha-value>)",
          200: "rgb(var(--grey-200) / <alpha-value>)",
          300: "rgb(var(--grey-300) / <alpha-value>)",
          400: "rgb(var(--grey-400) / <alpha-value>)",
          500: "rgb(var(--grey-500) / <alpha-value>)",
          600: "rgb(var(--grey-600) / <alpha-value>)",
          700: "rgb(var(--grey-700) / <alpha-value>)",
          800: "rgb(var(--grey-800) / <alpha-value>)",
          900: "rgb(var(--grey-900) / <alpha-value>)",
        },
        brand: "rgb(var(--brand) / <alpha-value>)",
        "brand-strong": "rgb(var(--brand-strong) / <alpha-value>)",
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-muted": "rgb(var(--surface-muted) / <alpha-value>)",
        "surface-hover": "rgb(var(--surface-hover) / <alpha-value>)",
        "surface-border": "rgb(var(--surface-border) / <alpha-value>)",
      },
      fontFamily: {
        sans: ['"Pretendard JP"', 'Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Roboto', 'sans-serif'],
      },
      backgroundImage: {
        "glass-gradient":
          "linear-gradient(135deg, rgb(var(--surface) / 0.85), rgb(var(--surface) / 0.35))",
      }
    }
  },
  plugins: []
};

export default config;
