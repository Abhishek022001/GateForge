/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc7fb',
          400: '#36aaf5',
          500: '#0c8ee9',
          600: '#006fc7',
          700: '#0159a2',
          800: '#054b85',
          900: '#0a3f6f',
          950: '#06284a',
        },
        slate: {
          850: '#151f32',
          950: '#090d16',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'glow': '0 0 25px -5px rgba(12, 142, 233, 0.3)',
        'glow-success': '0 0 25px -5px rgba(34, 197, 94, 0.3)',
        'glow-error': '0 0 25px -5px rgba(239, 68, 68, 0.3)',
      }
    },
  },
  plugins: [],
}
