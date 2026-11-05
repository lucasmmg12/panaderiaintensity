/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'surface': '#111317',
        'surface-dim': '#0c0e11',
        'surface-bright': '#282a2e',
        'surface-container-lowest': '#090a0d',
        'surface-container-low': '#16181d',
        'surface-container': '#1c1e24',
        'surface-container-high': '#24272f',
        'surface-container-highest': '#2e323b',
        'energy-orange': '#ea580c',
        'energy-orange-bright': '#f97316',
        'telemetry-cyan': '#00b4d8',
        'telemetry-sky': '#38bdf8',
        'clinical-blue': '#2563eb',
        'clinical-emerald': '#10b981',
        'mp-blue': '#009ee3',
      },
      fontFamily: {
        'headline': ['Oswald', 'Montserrat', 'sans-serif'],
        'body': ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
        'mono': ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}

