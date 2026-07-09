/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          // 초록우산 그린 계열
          DEFAULT: '#00a651',
          dark: '#00863f',
          light: '#e8f7ee'
        }
      }
    }
  },
  plugins: []
}
