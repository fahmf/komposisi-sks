import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7f3',
          100: '#d4ebe0',
          200: '#a9d7c2',
          300: '#76bd9d',
          400: '#479c79',
          500: '#2f8062',
          600: '#23664e',
          700: '#1d5240',
          800: '#194234',
          900: '#15372c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        arabic: ['"Noto Naskh Arabic"', '"Amiri"', 'serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
