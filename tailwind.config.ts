import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Refined emerald–teal brand ramp. 600 stays the anchor (#23664e) so
        // the PWA theme-color and app icon remain consistent, while the mid
        // tones are given a touch more life for a more premium feel.
        brand: {
          50: '#ecfaf4',
          100: '#cff0e2',
          200: '#a2e0c8',
          300: '#6bc9a6',
          400: '#3aac83',
          500: '#1f8f68',
          600: '#23664e',
          700: '#1d5240',
          800: '#194234',
          900: '#15372c',
          950: '#0b2019',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        arabic: ['"Noto Naskh Arabic"', '"Amiri"', 'serif'],
      },
      boxShadow: {
        // Layered, low-contrast elevation for a soft, modern surface language.
        soft: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 4px 12px -2px rgb(15 23 42 / 0.06)',
        elevated:
          '0 2px 4px -1px rgb(15 23 42 / 0.06), 0 12px 28px -6px rgb(15 23 42 / 0.14)',
        pop: '0 8px 24px -6px rgb(35 102 78 / 0.28)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #2a7a5c 0%, #23664e 55%, #194234 100%)',
      },
      keyframes: {
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.28s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
} satisfies Config;
