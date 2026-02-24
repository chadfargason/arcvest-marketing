import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: {
        '2xl': '1200px',
      },
    },
    extend: {
      colors: {
        // Warm palette (retirement pages)
        warm: {
          50: '#FFF8F0',
          100: '#FFF0DB',
          200: '#FFE0B8',
          300: '#FFD094',
          400: '#FFC070',
          500: '#F5A623',
          600: '#D48B1A',
          700: '#A36B14',
          800: '#724B0E',
          900: '#412B08',
          cream: '#FFFBF5',
          gold: '#C8963E',
        },
        // Navy palette (HNW pages)
        navy: {
          50: '#F0F4FA',
          100: '#DCE4F2',
          200: '#B8C9E5',
          300: '#8FAAD4',
          400: '#6B8DC3',
          500: '#1A365D',
          600: '#152C4E',
          700: '#0F2240',
          800: '#0A1832',
          900: '#060E1F',
          slate: '#2D3748',
          accent: '#4A90D9',
        },
        // Shared accent colors
        forest: {
          500: '#2D6A4F',
          600: '#245A42',
          700: '#1B4A35',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-merriweather)', 'Georgia', 'serif'],
      },
      fontSize: {
        'hero': ['3.5rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        'hero-mobile': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        'subhero': ['1.25rem', { lineHeight: '1.6' }],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
