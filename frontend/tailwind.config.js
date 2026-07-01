/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        aurbis: {
          blue:        '#1d4ed8',
          'blue-light':'#3b82f6',
          'blue-dark': '#1e3a8a',
          coral:       '#e8694a',
          'coral-light':'#f97316',
          teal:        '#0d9488',
          'teal-light':'#2dd4bf',
          dark:        '#0b1120',
          'dark-2':    '#111827',
          'dark-3':    '#1e293b',
          'dark-4':    '#263244',
          slate:       '#94a3b8',
          'slate-light':'#cbd5e1',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(135deg, #0b1120 0%, #1e3a8a 50%, #0d9488 100%)',
        'card-gradient': 'linear-gradient(135deg, #1e293b 0%, #263244 100%)',
        'blue-gradient': 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
        'coral-gradient': 'linear-gradient(135deg, #e8694a 0%, #f97316 100%)',
        'teal-gradient': 'linear-gradient(135deg, #0d9488 0%, #2dd4bf 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'typing': 'typing 1.2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        typing: {
          '0%, 60%, 100%': { transform: 'translateY(0)' },
          '30%': { transform: 'translateY(-6px)' },
        },
      },
      boxShadow: {
        'glow-blue': '0 0 20px rgba(59, 130, 246, 0.3)',
        'glow-teal': '0 0 20px rgba(13, 148, 136, 0.3)',
        'glow-coral': '0 0 20px rgba(232, 105, 74, 0.3)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
      }
    },
  },
  plugins: [],
}
