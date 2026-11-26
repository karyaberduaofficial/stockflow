/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        pine: {
          50: '#E8F3EC',
          100: '#D1E7D9',
          200: '#A3CFB4',
          500: '#2D6A4F',
          600: '#1B4332',
          700: '#133124',
          800: '#0F291E',
          900: '#091A13',
        },
        terracotta: {
          50: '#FDF0E9',
          100: '#FADBC9',
          500: '#D46A3C',
          600: '#C2592B',
          700: '#A3461F',
          800: '#7D3416',
        },
        ochre: {
          50: '#FEF7E6',
          100: '#FCEBC4',
          500: '#C98E26',
          600: '#B47B1B',
          700: '#8F6013',
        },
        espresso: {
          50: '#FAF8F5',
          100: '#F3EFE9',
          200: '#E5DED5',
          300: '#D4C9BC',
          400: '#A8A29E',
          500: '#78716C',
          600: '#57534E',
          700: '#3F3A36',
          800: '#292524',
          900: '#1C1917',
          950: '#141110',
        },
        alabaster: {
          DEFAULT: '#FAF8F5',
          subtle: '#F3EFE9',
          sand: '#E5DED5',
        },
        olive: {
          50: '#F2F7E6',
          600: '#4D7C0F',
          700: '#3F6212',
        },
        burgundy: {
          50: '#FCEBF2',
          600: '#7F1D4A',
          700: '#641539',
        },
        semantic: {
          success: '#15803D',
          successBg: '#E9F7EE',
          warning: '#B45309',
          warningBg: '#FEF3E2',
          danger: '#B91C1C',
          dangerBg: '#FDECEC',
          info: '#4D7C0F',
          infoBg: '#F2F7E6',
        },
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(28, 25, 23, 0.04), 0 4px 12px rgba(28, 25, 23, 0.03)',
        'card-hover': '0 4px 16px rgba(27, 67, 50, 0.08), 0 2px 6px rgba(28, 25, 23, 0.05)',
        modal: '0 20px 45px rgba(28, 25, 23, 0.22)',
      },
    },
  },
  plugins: [],
};
