/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        ink: {
          50:  '#f7f7f8',
          100: '#eeeef1',
          200: '#d9d9e0',
          300: '#b8b8c4',
          400: '#8d8da0',
          500: '#6b6b80',
          600: '#4f4f63',
          700: '#3d3d4e',
          800: '#26263a',
          900: '#14142b',
          950: '#0a0a19',
        },
        brand: {
          50:  '#eefbf5',
          100: '#d6f5e6',
          200: '#aeeace',
          300: '#78d9b0',
          400: '#3fc08b',
          500: '#1aa46f',
          600: '#0f8458',
          700: '#0c6947',
          800: '#0b533a',
          900: '#094431',
        },
      },
    },
  },
  plugins: [],
};
