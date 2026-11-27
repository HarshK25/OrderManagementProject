/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Instrument Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['"Instrument Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        sheet: {
          bg: '#ffffff',
          surface: '#f4f4f4',
          border: '#e5e5e5',
          ink: '#111111',
          muted: '#6b6b6b',
          accent: '#1a4be0',
        },
      },
    },
  },
  plugins: [],
}
