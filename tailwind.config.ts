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
      scrim: v('scrim'),
      sky: hue('sky'),
      apricot: hue('apricot'),
      teal: hue('teal'),
      stone: hue('stone'),
      lilac: hue('lilac'),
      rose: hue('rose'),
    },
    borderRadius: {
      none: '0',
      // Circle, not a fifth radius value: only the Switch track/thumb use it (tile-radius would make them squares).
      full: '9999px',
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
        sidebar: 'var(--sidebar-w)',
        panel: 'var(--panel-w)',
      },
      // Spec 5.4 type scale: title 26, section 18, money-xl 36, money 17. Body/small/meta reuse Tailwind's 16/14/12px defaults.
      fontSize: {
        title: ['26px', { lineHeight: '32px' }],
        section: ['18px', { lineHeight: '24px' }],
        'money-xl': ['36px', { lineHeight: '40px' }],
        money: ['17px', { lineHeight: '24px' }],
      },
      minHeight: { tap: 'var(--tap-min)' },
      minWidth: { tap: 'var(--tap-min)' },
      maxWidth: {
        phone: '480px',
        tablet: 'var(--max-tablet)',
        content: 'var(--max-content)',
      },
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
