import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        'grey': {
          50: '#f9fafb',
          100: '#f2f4f6',
          200: '#e5e8eb',
          300: '#d1d6db',
          400: '#b0b8c1',
          500: '#8b95a1',
          600: '#6b7684',
          700: '#4e5968',
          800: '#333d4b',
          900: '#191f28',
        },
        'brand': '#3182f6',
      },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Roboto', 'sans-serif'],
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.4))',
      }
    }
  },
  plugins: []
};

export default config;
