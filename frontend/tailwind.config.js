/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'rgb(var(--color-paper) / <alpha-value>)',
        shell: 'rgb(var(--color-shell) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        inverse: 'rgb(var(--color-inverse) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        graphite: 'rgb(var(--color-graphite) / <alpha-value>)',
        rail: 'rgb(var(--color-rail) / <alpha-value>)',
        signal: 'rgb(var(--color-signal) / <alpha-value>)',
        signalStrong: 'rgb(var(--color-signal-strong) / <alpha-value>)',
        moss: 'rgb(var(--color-moss) / <alpha-value>)',
        mossStrong: 'rgb(var(--color-moss-strong) / <alpha-value>)',
        amber: 'rgb(var(--color-amber) / <alpha-value>)',
        clay: 'rgb(var(--color-clay) / <alpha-value>)',
        clayStrong: 'rgb(var(--color-clay-strong) / <alpha-value>)',
      },
      fontFamily: {
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        focusline: '0 0 0 3px rgb(var(--color-signal) / 0.22)',
      },
    },
  },
  plugins: [],
}
