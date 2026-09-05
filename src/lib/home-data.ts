/**
 * Shared homepage data-resolution.
 *
 * The homepage config (HomepageConfig) only stores *product IDs* per section;
 * the full ProductCard objects come from a separate /products fetch. This
 * helper joins the two — the exact logic that used to be inlined in
 * index.astro's frontmatter.
 *
 * It is the SINGLE source of truth for that join, shared by:
 *   - src/pages/index.astro     (live, static SSR render)
 *   - src/views/home-preview.tsx (dashboard live-preview island)
 *
 * The thin "which component for which section key" switch is intentionally
 * NOT here — it differs slightly between the two callers (Astro JSX keeps
 * DealsOfDay's `client:visible` hydration; the preview renders everything
 * client-side). Keep the two switches in sync when adding/removing a block;
 * the per-block *rendering* itself lives once in src/components/home/*.
 */
import type {
  HomepageConfig,
  HomepageSectionKey,
  ProductCard,
  Category,
} from './types';

/** Default section order when the tenant hasn't customised it. */
export const DEFAULT_SECTION_ORDER: HomepageSectionKey[] = [
  'hero', 'categories', 'feature_products', 'promo_row',
  'trending_products', 'brand_strip', 'promo_banner',
  'most_selling', 'card_payment_promo', 'deals_of_day',
  'services_row', 'trust_badges',
];

export type PromoRowItem = { card: HomepageConfig['promo_row']['cards'][number]; product: ProductCard };

export type ResolvedHomeData = {
  heroProducts: ProductCard[];
  featureProducts: ProductCard[];
  trendingProducts: ProductCard[];
  mostSellingProducts: ProductCard[];
  dealsProducts: ProductCard[];
  promoRowItems: PromoRowItem[];
  dealsSpotlight: ProductCard | null;
  /**
   * Whether the merchant explicitly CHOSE a spotlight (spotlight_id set),
   * independent of whether it resolved. DealsOfDay uses this to refuse to
   * substitute a mini card for a chosen-but-unresolvable spotlight.
   */
  dealsSpotlightConfigured: boolean;
  homepageCategories: Category[];
  sectionOrder: HomepageSectionKey[];
};

/**
 * Every product id the homepage config references, deduped. The general
 * /products list is newest-first and CAPPED by the API (60), so on a bigger
 * catalog an older pick silently failed to resolve here and vanished from
 * its section — see api.ts ensureHomepageProducts, which fetches exactly
 * these by id.
 */
export function homepageProductIds(home: HomepageConfig | null): number[] {
  if (!home) return [];
  const ids = new Set<number>();
  const add = (list: Array<number | null | undefined>) => {
    for (const id of list) {
      if (typeof id === 'number' && Number.isInteger(id) && id > 0) ids.add(id);
    }
  };
  add(home.hero.product_ids ?? []);
  add(home.feature_products.product_ids ?? []);
  add(home.trending_products.product_ids ?? []);
  add(home.most_selling.product_ids ?? []);
  add((home.promo_row.cards ?? []).map((c) => c.product_id));
  add([home.deals_of_day.spotlight_id]);
  add(home.deals_of_day.product_ids ?? []);
  return [...ids];
}

/**
 * Which product fills the Deals of the Day centre, and which stay minis.
 *
 * A spotlight the merchant CHOSE but which failed to resolve (hidden,
 * deleted, not fetched) is NEVER substituted with a mini card — that showed
 * a DIFFERENT product as the deal of the day, with a countdown, while the
 * dashboard still said the merchant's pick (live 2026-09-06). Promoting the
 * first mini is only the default for a section with no spotlight chosen.
 * `featured === null` with a non-empty `rest` means "render the minis
 * honestly, no centrepiece". Pure so it is probed directly.
 */
export function dealsLayout(
  spotlight: ProductCard | null,
  products: ProductCard[],
  spotlightConfigured: boolean,
): { featured: ProductCard | null; rest: ProductCard[] } {
  if (spotlight) return { featured: spotlight, rest: products };
  if (products.length > 0 && !spotlightConfigured) {
    return { featured: products[0], rest: products.slice(1) };
  }
  return { featured: null, rest: products };
}

/**
 * Join a homepage config against the fetched products + categories.
 * `home` may be null (API unreachable) — callers guard on `meta && home`.
 */
export function resolveHomeData(
  home: HomepageConfig | null,
  products: ProductCard[],
  categories: Category[],
): ResolvedHomeData {
  const byId = new Map(products.map((p) => [p.id, p]));
  const resolve = (ids: number[]): ProductCard[] =>
    ids.map((id) => byId.get(id)).filter(Boolean) as ProductCard[];

  const promoRowItems: PromoRowItem[] = home
    ? (home.promo_row.cards
        .map((card) => {
          const p = card.product_id ? byId.get(card.product_id) : null;
          return p ? { card, product: p } : null;
        })
        .filter(Boolean) as PromoRowItem[])
    : [];

  const dealsSpotlightConfigured = !!home?.deals_of_day.spotlight_id;
  const dealsSpotlight = dealsSpotlightConfigured
    ? byId.get(home!.deals_of_day.spotlight_id as number) ?? null
    : null;

  // Categories strip: if the merchant picked specific categories, show exactly
  // those in their chosen order; otherwise fall back to ALL visible categories.
  const catById = new Map(categories.map((c) => [c.id, c]));
  const homepageCategories = home?.categories?.category_ids?.length
    ? (home.categories.category_ids.map((id) => catById.get(id)).filter(Boolean) as Category[])
    : categories;

  const sectionOrder: HomepageSectionKey[] = home?.section_order?.length
    ? home.section_order
    : DEFAULT_SECTION_ORDER;

  return {
    heroProducts: home ? resolve(home.hero.product_ids) : [],
    featureProducts: home ? resolve(home.feature_products.product_ids) : [],
    trendingProducts: home ? resolve(home.trending_products.product_ids) : [],
    mostSellingProducts: home ? resolve(home.most_selling.product_ids) : [],
    dealsProducts: home ? resolve(home.deals_of_day.product_ids) : [],
    promoRowItems,
    dealsSpotlight,
    dealsSpotlightConfigured,
    homepageCategories,
    sectionOrder,
  };
}
