/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sigflo: {
          bg: '#050505',
          surface: '#0b0b0f',
          elevated: '#111116',
          border: 'rgba(255,255,255,0.06)',
          muted: '#6b7280',
          text: '#e5e7eb',
          accent: '#00FFC8',
          accentDim: 'rgba(0,255,200,0.10)',
          profit: '#34d399',
          profitDim: 'rgba(52,211,153,0.12)',
          loss: '#f87171',
          lossDim: 'rgba(248,113,113,0.12)',
        },
      },
      boxShadow: {
        glow: '0 0 40px -12px rgba(0,255,200,0.25)',
        'glow-sm': '0 0 24px -8px rgba(0,255,200,0.18)',
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
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(0.85)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'glow-breathe': {
          '0%, 100%': { boxShadow: '0 0 0 1px rgba(0,255,200,0.15), 0 0 20px rgba(0,255,200,0.08)' },
          '50%': { boxShadow: '0 0 0 1px rgba(0,255,200,0.30), 0 0 32px rgba(0,255,200,0.15)' },
        },
      },
      animation: {
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
        'fade-in-up': 'fade-in-up 0.35s ease-out',
        'glow-breathe': 'glow-breathe 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
