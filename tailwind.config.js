/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Archivo Variable"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
      },
      colors: {
        ink: { DEFAULT: '#20242C', soft: '#3A3F4A' },
        page: '#F1F3F5',
        line: '#E2E5EA',
        muted: '#5B6270',
        faint: '#8A909C',
        brand: { DEFAULT: '#D9232A', dark: '#B01A20' },
        tag: { DEFAULT: '#FFD43B', soft: '#FFF4C2' },
        risk: {
          critico: '#D03B3B',
          alto: '#EC835A',
          medio: '#FAB219',
          bajo: '#0CA30C',
        },
        riskText: {
          critico: '#A82525',
          alto: '#A9481E',
          medio: '#7D5300',
          bajo: '#0A6B0A',
        },
        riskBg: {
          critico: '#FCECEC',
          alto: '#FDF0E9',
          medio: '#FFF6E0',
          bajo: '#E9F7E9',
        },
      },
      boxShadow: {
        card: '0 1px 0 rgba(32,36,44,0.04), 0 0 0 1px rgba(32,36,44,0.06)',
        pop: '0 12px 32px -8px rgba(32,36,44,0.28)',
      },
      borderRadius: { tag: '6px' },
    },
  },
  plugins: [],
};
