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
        /** Marketing landing page palette */
        landing: {
          bg: '#0F1115',
          /** Mid-band sections — slightly lifted from hero */
          mid: '#11151A',
          surface: '#171A20',
          card: '#1E222A',
          accent: '#00C878',
          'accent-hi': '#00E08A',
          'accent-dim': 'rgba(0, 200, 120, 0.12)',
          'accent-glow': 'rgba(0, 200, 120, 0.35)',
          text: '#F5F7FA',
          muted: 'rgba(245, 247, 250, 0.72)',
          border: 'rgba(255, 255, 255, 0.08)',
        },
      },
      boxShadow: {
        glow: '0 0 40px -12px rgba(0,255,200,0.25)',
        'glow-sm': '0 0 24px -8px rgba(0,255,200,0.18)',
        card: '0 8px 32px rgba(0,0,0,0.45)',
        'landing-glow': '0 0 80px -20px rgba(0, 200, 120, 0.35)',
        'landing-glow-sm': '0 0 48px -16px rgba(0, 200, 120, 0.22)',
        'landing-card': '0 12px 40px rgba(0, 0, 0, 0.4)',
        'landing-card-strong':
          '0 16px 48px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.06) inset',
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
        'spark-glow': {
          '0%, 100%': {
            opacity: '0.88',
            filter: 'drop-shadow(0 0 2px rgba(0,255,200,0.12))',
          },
          '50%': { opacity: '1', filter: 'drop-shadow(0 0 7px rgba(0,255,200,0.28))' },
        },
        /** Slow sheen across winning position cards */
        'position-shimmer': {
          '0%': { transform: 'translateX(-120%) skewX(-14deg)', opacity: '0' },
          '12%': { opacity: '0.14' },
          '55%': { opacity: '0.06' },
          '100%': { transform: 'translateX(220%) skewX(-14deg)', opacity: '0' },
        },
      },
      animation: {
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
        'fade-in-up': 'fade-in-up 0.35s ease-out',
        'glow-breathe': 'glow-breathe 4s ease-in-out infinite',
        'spark-glow': 'spark-glow 5s ease-in-out infinite',
        'position-shimmer': 'position-shimmer 7.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
