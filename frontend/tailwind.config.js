/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f7f5ef',
        ink: '#161814',
        graphite: '#4b5249',
        rail: '#d9d2c4',
        signal: '#1f7a8c',
        moss: '#5d7c52',
        amber: '#bc7a28',
        clay: '#a44a3f',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        focusline: '0 0 0 3px rgba(31, 122, 140, 0.22)',
      },
    },
  },
  plugins: [],
}
