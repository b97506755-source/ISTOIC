import type { Config } from 'tailwindcss';

const withOpacity = (variable: string) => {
  return ({ opacityValue }: { opacityValue?: string }) => {
    if (opacityValue === undefined) {
      return `rgb(var(${variable}))`;
    }
    return `rgb(var(${variable}) / ${opacityValue})`;
  };
};

const config: Config = {
  content: [
    './index.html',
    './App.tsx',
    './components/**/*.{ts,tsx,js,jsx}',
    './features/**/*.{ts,tsx,js,jsx}',
    './contexts/**/*.{ts,tsx,js,jsx}',
    './hooks/**/*.{ts,tsx,js,jsx}',
    './services/**/*.{ts,tsx,js,jsx}',
    './utils/**/*.{ts,tsx,js,jsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          '"Liberation Mono"',
          '"Courier New"',
          'monospace'
        ],
        serif: ['"Playfair Display"', 'ui-serif', 'Georgia', '"Times New Roman"', 'serif']
      },
      colors: {
        bg: withOpacity('--bg-rgb'),
        'bg-elevated': withOpacity('--bg-elevated-rgb'),
        surface: withOpacity('--surface-rgb'),
        'surface-2': withOpacity('--surface-2-rgb'),
        border: withOpacity('--border-rgb'),
        text: withOpacity('--text-rgb'),
        'text-muted': withOpacity('--text-muted-rgb'),
        'text-invert': withOpacity('--text-invert-rgb'),
        accent: withOpacity('--accent-rgb'),
        'accent-2': withOpacity('--accent-2-rgb'),
        danger: withOpacity('--danger-rgb'),
        warning: withOpacity('--warning-rgb'),
        success: withOpacity('--success-rgb'),
        info: withOpacity('--info-rgb'),
        focus: withOpacity('--focus-rgb'),
        // legacy aliases
        'skin-main': withOpacity('--bg-rgb'),
        'skin-card': withOpacity('--surface-rgb'),
        'skin-surface': withOpacity('--surface-rgb'),
        'skin-surface-hover': withOpacity('--surface-2-rgb'),
        'skin-border': withOpacity('--border-rgb'),
        'skin-highlight': withOpacity('--accent-rgb'),
        'skin-text': withOpacity('--text-rgb'),
        'skin-muted': withOpacity('--text-muted-rgb')
      },
      borderColor: (theme) => ({
        ...theme('colors')
      }),
      textColor: (theme) => ({
        ...theme('colors')
      }),
      backgroundColor: (theme) => ({
        ...theme('colors')
      })
    }
  },
  plugins: []
};

export default config;
