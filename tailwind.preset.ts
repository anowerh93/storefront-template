import type { Config } from 'tailwindcss';

/**
 * Tailwind v4 preset for the Reply.BD storefront template.
 *
 * In v4, theme tokens are usually declared in CSS via @theme, but a preset
 * is still useful for content-scanning rules and v3-compatible plugin lists.
 * The thin shell extends this preset; tenant-level overrides happen via the
 * theme color stored on the user (`storefront_theme_color`) which the
 * runtime reads from the API and injects via inline CSS variables.
 */
const preset: Config = {
  content: [
    './src/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      // Most theming lives in src/styles.css under @theme — we only carry
      // here the bits Tailwind v3-style plugins might need.
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
};

export default preset;
