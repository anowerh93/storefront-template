/**
 * The homepage hero's uploaded banner — which files, at which sizes.
 *
 * ONE answer for the <img>/<picture> in components/home/hero-grid.tsx and the
 * <link rel=preload> in pages/index.astro: when the two disagree on srcset,
 * sizes or media the browser preloads one file and renders another (a double
 * download of the LCP image).
 *
 * hero.layout ('grid' | 'single') and hero.mobile_image_url come from myapp
 * (HomepageConfig::forApi). An API from before they existed sends neither:
 * no layout = the grid, no phone image = the banner on every screen.
 */
import type { HomepageConfig } from './types';
import {
  cdnSrcSet,
  singleBannerSrcSet,
  BANNER_WIDTHS,
  BANNER_SIZES,
  SINGLE_BANNER_SIZES,
  PHONE_BANNER_SIZES,
} from './img';

type Hero = HomepageConfig['hero'];

/** One banner across the whole hero — only when the API says so. */
export function isSingleHero(hero: Hero | null | undefined): boolean {
  return hero?.layout === 'single';
}

export type BannerFile = { src: string; srcSet?: string; sizes?: string };

/**
 * The uploaded banner's files: `wide` (every screen, or 640px and up when a
 * phone image is set) and `phone` (below 640px). null when no banner image is
 * set — a phone image alone is never shown (the hero then falls back to the
 * featured product like before).
 */
export function heroBannerFiles(hero: Hero | null | undefined): { wide: BannerFile; phone: BannerFile | null } | null {
  const url = hero?.image_url;
  if (!url) return null;

  const single = isSingleHero(hero);
  const wideSet = single ? singleBannerSrcSet(url) : cdnSrcSet(url, BANNER_WIDTHS);
  const wide: BannerFile = { src: url, srcSet: wideSet, sizes: wideSet ? (single ? SINGLE_BANNER_SIZES : BANNER_SIZES) : undefined };

  const phoneUrl = hero?.mobile_image_url;
  if (!phoneUrl) return { wide, phone: null };

  const phoneSet = cdnSrcSet(phoneUrl, BANNER_WIDTHS);
  return { wide, phone: { src: phoneUrl, srcSet: phoneSet, sizes: phoneSet ? PHONE_BANNER_SIZES : undefined } };
}
