/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#090D16',
        sidebar: '#0C111B',
        surface: {
          DEFAULT: '#111827',
          elevated: '#151E2D',
          hover: '#1A2436'
        },
        border: {
          DEFAULT: '#253044',
          subtle: '#1C2638'
        },
        accent: {
          DEFAULT: '#22D3EE',
          subtle: 'rgba(34, 211, 238, 0.1)',
          hover: '#06B6D4'
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      }
    },
  },
  plugins: [],
}
