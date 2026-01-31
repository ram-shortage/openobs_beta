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
        // Obsidian-inspired color palette
        background: {
          primary: 'var(--background-primary)',
          secondary: 'var(--background-secondary)',
          modifier: {
            hover: 'var(--background-modifier-hover)',
            active: 'var(--background-modifier-active)',
            border: 'var(--background-modifier-border)',
          },
        },
        text: {
          normal: 'var(--text-normal)',
          muted: 'var(--text-muted)',
          faint: 'var(--text-faint)',
          accent: 'var(--text-accent)',
        },
        interactive: {
          normal: 'var(--interactive-normal)',
          hover: 'var(--interactive-hover)',
          accent: 'var(--interactive-accent)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
