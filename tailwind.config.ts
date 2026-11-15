import plugin from 'tailwindcss/plugin';
import type { Config } from 'tailwindcss';

// Every colour reads a CSS variable from tokens.css, so a theme switch is only a
// variable swap and components never need dark: variants. <alpha-value> keeps
// opacity utilities (bg-accent/20) working with the RGB-channel variables.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const hue = (h: string) => ({
  bg: v(`${h}-bg`),
  ink: v(`${h}-ink`),
  mark: v(`${h}-mark`),
});

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Replace (not extend) the default palette and radii so off-token values cannot be used by accident.
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      ground: v('ground'),
      surface: v('surface'),
      raised: v('raised'),
      border: v('border'),
      rule: v('rule'),
      control: v('control'),
      text: v('text'),
      muted: v('muted'),
      accent: v('accent'),
      'on-accent': v('on-accent'),
      positive: v('positive'),
      negative: v('negative'),
      warning: v('warning'),
      sky: hue('sky'),
      apricot: hue('apricot'),
      teal: hue('teal'),
      stone: hue('stone'),
      lilac: hue('lilac'),
      rose: hue('rose'),
    },
    borderRadius: {
      none: '0',
      dot: 'var(--radius-dot)',
      pill: 'var(--radius-pill)',
      tile: 'var(--radius-tile)',
      card: 'var(--radius-card)',
    },
    // Spec 5.4 allows only three weights; replacing the scale makes font-bold/black etc. unavailable.
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
    },
    // Spec 5.5: nothing resting has a shadow. Only floating layers (sheet, toast, menu) may use `float`.
    boxShadow: {
      none: 'none',
      float: 'var(--shadow-float)',
    },
    extend: {
      fontFamily: {
        sans: ['"Manrope"', '"Anuphan"', 'system-ui', 'sans-serif'],
      },
      spacing: {
        gap: 'var(--gap)',
        card: 'var(--pad-card)',
        screen: 'var(--pad-screen)',
      },
      // Spec 5.4 type scale for money; body/small reuse Tailwind's 16/14px defaults.
      fontSize: {
        'money-xl': ['36px', { lineHeight: '40px' }],
        money: ['17px', { lineHeight: '24px' }],
      },
      minHeight: { tap: 'var(--tap-min)' },
      minWidth: { tap: 'var(--tap-min)' },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
        'in-out': 'var(--ease-in-out)',
        drawer: 'var(--ease-drawer)',
      },
      transitionDuration: {
        press: 'var(--dur-press)',
        fast: 'var(--dur-fast)',
        base: 'var(--dur-base)',
        sheet: 'var(--dur-sheet)',
      },
    },
  },
  plugins: [
    // Hover exists only for a real mouse. Without this gate, touch devices keep the hover style stuck
    // after a tap. Usage: `hover-fine:hover:opacity-90` (the :hover pseudo-class is still required).
    plugin(({ addVariant }) => {
      addVariant('hover-fine', '@media (hover: hover) and (pointer: fine)');
    }),
  ],
} satisfies Config;
