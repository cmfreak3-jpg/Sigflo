/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sigflo: {
          bg: '#050506',
          surface: '#0c0c0f',
          elevated: '#121218',
          border: 'rgba(255,255,255,0.06)',
          muted: '#6b7280',
          text: '#e5e7eb',
          accent: '#22d3ee',
          accentDim: 'rgba(34,211,238,0.12)',
          profit: '#34d399',
          profitDim: 'rgba(52,211,153,0.12)',
          loss: '#f87171',
          lossDim: 'rgba(248,113,113,0.12)',
        },
      },
      boxShadow: {
        glow: '0 0 40px -12px rgba(34,211,238,0.25)',
        'glow-sm': '0 0 24px -8px rgba(52,211,153,0.2)',
        card: '0 8px 32px rgba(0,0,0,0.45)',
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
