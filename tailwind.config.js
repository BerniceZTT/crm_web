/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        }
      },
      boxShadow: {
        card: '0 4px 12px rgba(0, 0, 0, 0.03)',
        dropdown: '0 4px 20px rgba(0, 0, 0, 0.08)',
        button: '0 2px 8px rgba(79, 70, 229, 0.2)',
      },
    },
  },
  plugins: [],
}
