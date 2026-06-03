/**
 * Theme color injection.
 *
 * The tenant's brand color (hex) lives in `users.storefront_theme_color` and
 * is exposed by the metadata API. We translate that hex into CSS variables
 * for Tailwind v4's @theme system. The variables override the defaults
 * declared in src/styles.css.
 *
 * This runs server-side in the root layout, producing an inline <style>
 * tag — no client JS, no flash of unthemed content.
 */

export function brandCssVars(themeColor: string | null): string {
  const hex = (themeColor ?? '#F07F13').replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '';

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  // Build a small 50–950 ramp by darkening/lightening the brand color.
  // Not perceptually perfect (a real palette generator would use OKLCH),
  // but good enough for buttons + accents — and zero runtime deps.
  const tint = (amt: number) => {
    const tr = Math.round(r + (255 - r) * amt);
    const tg = Math.round(g + (255 - g) * amt);
    const tb = Math.round(b + (255 - b) * amt);
    return `rgb(${tr} ${tg} ${tb})`;
  };
  const shade = (amt: number) => {
    const sr = Math.round(r * (1 - amt));
    const sg = Math.round(g * (1 - amt));
    const sb = Math.round(b * (1 - amt));
    return `rgb(${sr} ${sg} ${sb})`;
  };

  return [
    `--color-brand-50:  ${tint(0.95)};`,
    `--color-brand-100: ${tint(0.85)};`,
    `--color-brand-200: ${tint(0.7)};`,
    `--color-brand-300: ${tint(0.5)};`,
    `--color-brand-400: ${tint(0.25)};`,
    `--color-brand-500: rgb(${r} ${g} ${b});`,
    `--color-brand-600: ${shade(0.1)};`,
    `--color-brand-700: ${shade(0.25)};`,
    `--color-brand-800: ${shade(0.4)};`,
    `--color-brand-900: ${shade(0.55)};`,
    `--color-brand-950: ${shade(0.7)};`,
  ].join(' ');
}
