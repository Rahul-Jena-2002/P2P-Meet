/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0b0e14',
          800: '#151921',
          700: '#1e2430',
          600: '#2b3242'
        },
        brand: {
          500: '#2563eb',
          600: '#1d4ed8',
          accent: '#06b6d4'
        }
      }
    },
  },
  plugins: [],
}
