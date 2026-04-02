/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'claude-primary': '#D97706',
        'claude-secondary': '#F59E0B',
        'copilot-primary': '#10B981',
        'copilot-secondary': '#34D399',
        'codex-primary': '#8B5CF6',
        'codex-secondary': '#A78BFA',
        'bg-primary': '#1a1a2e',
        'bg-secondary': '#16213e',
        'bg-tertiary': '#0f3460',
        'text-primary': '#eaeaea',
        'text-secondary': '#a0a0a0',
      },
    },
  },
  plugins: [],
}
