/**
 * Design tokens — "refined industrial".
 *
 * The app is a data tool used for hours at a time on warehouse floors, so the
 * system favours: crisp bordered panels over floating cards, cool neutrals,
 * a single accent colour used with intent, tabular numerals, and AA contrast.
 *
 * The neutral ramp deliberately redefines Tailwind's `gray`, which means every
 * existing `bg-gray-*` / `text-gray-*` class across the app adopts the new
 * palette without a mass rename.
 */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './ui-review.html',
    './*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
    './utils/**/*.{ts,tsx}',
    './sw.ts',
  ],
  theme: {
    extend: {
      colors: {
        // Cool, high-legibility neutral ramp (slate-based, tuned darker at the top).
        gray: {
          25: '#fbfcfe',
          50: '#f7f9fb',
          100: '#eef2f6',
          200: '#e0e7ee',
          300: '#c8d3de',
          400: '#93a1b1',
          500: '#5f6e80',
          600: '#4a5766',
          700: '#374252',
          800: '#222a36',
          900: '#151b24',
          950: '#0b0f16',
        },
        // Brand orange, extended so fills can hit AA contrast with white text.
        brand: {
          50: '#fff8f1',
          100: '#ffeedf',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
        // Semantic tones, used for status only (never for decorative buttons).
        success: {
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          900: '#064e3b',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          900: '#78350f',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          900: '#7f1d1d',
        },
        info: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        arabic: ['Cairo', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // A tighter, more editorial scale than Tailwind's default for dense screens.
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.02em' }],
        xs: ['0.75rem', { lineHeight: '1.125rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.875rem', { lineHeight: '1.375rem' }],
        md: ['0.9375rem', { lineHeight: '1.5rem' }],
        lg: ['1.0625rem', { lineHeight: '1.5rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '1.875rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.125rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },
      borderRadius: {
        md: '0.5rem',
        lg: '0.625rem',
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      boxShadow: {
        // Elevation is reserved for things that float above the page.
        xs: '0 1px 2px 0 rgb(11 15 22 / 0.04)',
        card: '0 1px 2px 0 rgb(11 15 22 / 0.04), 0 1px 3px 0 rgb(11 15 22 / 0.06)',
        pop: '0 8px 24px -6px rgb(11 15 22 / 0.18), 0 2px 8px -3px rgb(11 15 22 / 0.12)',
        sheet: '0 -12px 40px -12px rgb(11 15 22 / 0.28)',
        focus: '0 0 0 3px rgb(249 115 22 / 0.28)',
        'focus-danger': '0 0 0 3px rgb(239 68 68 / 0.25)',
      },
      spacing: {
        4.5: '1.125rem',
        13: '3.25rem',
        15: '3.75rem',
        18: '4.5rem',
        68: '17rem',
        72: '18rem',
      },
      zIndex: {
        dropdown: '40',
        sticky: '30',
        sheet: '60',
        modal: '70',
        toast: '80',
        palette: '90',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'sheet-up': {
          from: { transform: 'translateY(12px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'pop-in': {
          from: { transform: 'translateY(-4px) scale(0.98)', opacity: '0' },
          to: { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 140ms ease-out',
        'sheet-up': 'sheet-up 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'pop-in': 'pop-in 120ms ease-out',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};
