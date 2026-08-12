/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#fcfbfa', // Warm alabaster background
        surface: {
          DEFAULT: '#ffffff', // Pure white cards
          elevated: '#f4f3f0', // Warm grey elevation
          popover: '#ffffff'
        },
        border: 'rgba(0, 0, 0, 0.08)',
        primary: {
          DEFAULT: '#0f766e', // Forest Teal
          hover: '#0f766e',
          glow: 'rgba(15, 118, 110, 0.15)'
        },
        secondary: {
          DEFAULT: '#d97706', // Warm Amber
          hover: '#b45309'
        },
        success: {
          DEFAULT: '#10b981', // Emerald Green
          hover: '#059669'
        },
        warning: {
          DEFAULT: '#f59e0b', // Amber Warning
          hover: '#d97706'
        },
        danger: {
          DEFAULT: '#ef4444', // Rose Red
          hover: '#dc2626'
        },
        text: {
          primary: '#0f172a', // Deep Slate 900
          secondary: '#475569', // Cool Grey 600
          muted: '#94a3b8' // Slate 400
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      boxShadow: {
        glow: '0 0 15px var(--tw-shadow-color)',
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
      }
    }
  },
  plugins: [],
}
