/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        apple: {
          blue: 'rgb(var(--accent-r) var(--accent-g) var(--accent-b) / <alpha-value>)',
          gray: '#f5f5f7',
          dark: '#1c1c1e',
          'text': '#1d1d1f',
          'text-secondary': '#86868b',
        },
        difficulty: {
          beginner: '#34c759',
          intermediate: '#ff9500',
          advanced: '#ff3b30',
        },
      },
      borderRadius: {
        'apple': '16px',
        'bubble': 'var(--bubble-radius)',
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', 'system-ui', '-apple-system', 'PingFang SC', 'Hiragino Sans', 'sans-serif'],
      },
      animation: {
        'slide-in-right': 'slideInRight 300ms ease-out',
        'slide-out-right': 'slideOutRight 300ms ease-in',
        'fade-in': 'fadeIn 200ms ease-out',
        'bounce-dot': 'bounceDot 1.4s ease-in-out infinite',
        'scale-in': 'scaleIn 150ms ease-out',
      },
      keyframes: {
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideOutRight: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(100%)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        bounceDot: {
          '0%, 80%, 100%': { transform: 'scale(0)' },
          '40%': { transform: 'scale(1)' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};