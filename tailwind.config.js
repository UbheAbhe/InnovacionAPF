/** @type {import('tailwindcss').Config} */
// Paleta tomada de la fachada de Tiendas 3A: naranja del letrero y la pared,
// azul marino de las letras "3A" y de la franja bajo el letrero.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Archivo Variable"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
      },
      colors: {
        // Texto y acciones principales: azul marino 3A oscurecido
        ink: { DEFAULT: '#18204A', soft: '#2A3466' },
        // Azul marino de la marca (barra lateral)
        navy: { DEFAULT: '#1F2C7A', deep: '#172160', line: '#2E3C8C' },
        page: '#F3F4F7',
        line: '#DEE1E8',
        muted: '#5B6270',
        faint: '#7A8193',
        // Naranja 3A: DEFAULT para rellenos y gráficos; dark para texto y botones con texto blanco (AA)
        brand: { DEFAULT: '#E8461E', dark: '#C93A12', soft: '#FDECE5' },
        // Naranja claro, legible sobre azul marino
        tag: { DEFAULT: '#FF8A5C', soft: '#FFF1EA' },
        risk: {
          critico: '#C62828',
          alto: '#E8890C',
          medio: '#F2B705',
          bajo: '#1E9B4B',
        },
        riskText: {
          critico: '#A11D1D',
          alto: '#94500A',
          medio: '#755800',
          bajo: '#14703A',
        },
        riskBg: {
          critico: '#FBEAEA',
          alto: '#FDF1E3',
          medio: '#FEF6D8',
          bajo: '#E7F5EC',
        },
      },
      boxShadow: {
        card: '0 0 0 1px #DEE1E8',
        pop: '0 10px 28px -10px rgba(24,32,74,0.35), 0 0 0 1px rgba(24,32,74,0.08)',
      },
      borderRadius: { tag: '4px' },
    },
  },
  plugins: [],
};
