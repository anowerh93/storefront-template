/**
 * Dashboard live-preview island.
 *
 * Renders the EXACT same homepage component tree as the live site
 * (src/pages/index.astro), but client-side and driven by a draft
 * HomepageConfig pushed over postMessage from the myapp dashboard builder.
 * As the merchant edits, the dashboard scrapes its form into a config and
 * posts it here; this island swaps state and re-renders instantly — no save,
 * no redeploy.
 *
 * Why a full client render (not SSR): the draft config must re-resolve
 * product IDs → cards and re-run the section switch in the browser on every
 * keystroke. Products/categories are fetched once (live) and passed as initial
 * props; only `home` is stateful.
 *
 * Fidelity: every block is rendered by the same src/components/home/*
 * component the live site uses (single source of truth). Only the thin switch
 * below is duplicated from index.astro — keep the two in sync when a block is
 * added/removed (mirrors the note in src/lib/home-data.ts).
 */
import { useEffect, useState } from 'react';
import type { StorefrontMeta, ProductCard, Category, HomepageConfig } from '../lib/types';
import { resolveHomeData } from '../lib/home-data';
import {
  PREVIEW_READY,
  isPreviewConfigMessage,
} from '../lib/preview-protocol';

import { Header } from '../components/layout/header';
import { Footer } from '../components/layout/footer';
import { MessengerCTA } from '../components/layout/messenger-cta';
import { HeroGrid } from '../components/home/hero-grid';
import { CategoryStrip } from '../components/home/category-strip';
import { ProductRow } from '../components/home/product-row';
import { PromoRow } from '../components/home/promo-row';
import { BrandStrip } from '../components/home/brand-strip';
import { PromoBanner } from '../components/home/promo-banner';
import { CardPaymentPromo } from '../components/home/card-payment-promo';
import { DealsOfDay } from '../components/home/deals-of-day';
import { ServicesRow } from '../components/home/services-row';
import { TrustBadges } from '../components/home/trust-badges';

type Props = {
  meta: StorefrontMeta;
  products: ProductCard[];
  categories: Category[];
};

/**
 * Resolve the embedding dashboard's origin (client-side only). Prefer the
 * explicit ?parent= param the dashboard sets on the iframe URL; fall back to
 * the referrer. Returns '' when not framed / undeterminable — in which case we
 * accept no messages (the page just shows the live config, harmlessly).
 */
function resolveParentOrigin(): string {
  if (typeof window === 'undefined') return '';
  try {
    const fromParam = new URLSearchParams(window.location.search).get('parent');
    if (fromParam) return new URL(fromParam).origin;
    if (document.referrer) return new URL(document.referrer).origin;
  } catch {
    /* malformed — fall through to no-origin */
  }
  return '';
}

export function HomePreview({ meta, products, categories }: Props) {
  // Seed from the live config; replaced wholesale on each dashboard push.
  const [home, setHome] = useState<HomepageConfig>(meta.homepage);

  useEffect(() => {
    const parentOrigin = resolveParentOrigin();
    if (!parentOrigin) return; // not framed by a known dashboard — stay static

    function onMessage(event: MessageEvent) {
      // Origin allowlist — ignore anything not from the embedding dashboard.
      if (event.origin !== parentOrigin) return;
      if (isPreviewConfigMessage(event.data)) {
        setHome(event.data.config);
      }
    }
    window.addEventListener('message', onMessage);

    // Handshake: tell the dashboard we're mounted so it sends the current
    // draft immediately (covers edits made before the iframe finished loading).
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ source: PREVIEW_READY }, parentOrigin);
    }

    return () => window.removeEventListener('message', onMessage);
  }, []);

  const {
    heroProducts,
    featureProducts,
    trendingProducts,
    mostSellingProducts,
    dealsProducts,
    promoRowItems,
    dealsSpotlight,
    homepageCategories,
    sectionOrder,
  } = resolveHomeData(home, products, categories);

  return (
    <>
      <Header meta={meta} categories={categories} />

      <main className="pb-12">
        {sectionOrder.map((key) => {
          switch (key) {
            case 'hero':
              return home.hero.visible && (home.hero.image_url || heroProducts.length > 0)
                ? <HeroGrid key={key} featured={heroProducts} hero={home.hero} />
                : null;
            case 'categories':
              return home.categories.visible
                ? <CategoryStrip key={key} categories={homepageCategories} title={home.categories.title} />
                : null;
            case 'feature_products':
              return home.feature_products.visible && featureProducts.length > 0
                ? <ProductRow
                    key={key}
                    title={home.feature_products.title}
                    subtitle={home.feature_products.subtitle}
                    products={featureProducts}
                    cols={5}
                  />
                : null;
            case 'promo_row':
              return home.promo_row.visible && promoRowItems.length === 3
                ? <PromoRow
                    key={key}
                    products={promoRowItems.map((x) => x.product)}
                    cards={promoRowItems.map((x) => x.card)}
                  />
                : null;
            case 'trending_products':
              return home.trending_products.visible && trendingProducts.length > 0
                ? <ProductRow
                    key={key}
                    title={home.trending_products.title}
                    subtitle={home.trending_products.subtitle}
                    products={trendingProducts}
                    cols={5}
                  />
                : null;
            case 'brand_strip':
              return home.brand_strip.visible
                ? <BrandStrip key={key} items={home.brand_strip.items} />
                : null;
            case 'promo_banner':
              return home.promo_banner.visible
                ? <PromoBanner key={key} config={home.promo_banner} />
                : null;
            case 'most_selling':
              return home.most_selling.visible && mostSellingProducts.length > 0
                ? <ProductRow
                    key={key}
                    title={home.most_selling.title}
                    subtitle={home.most_selling.subtitle}
                    products={mostSellingProducts}
                    cols={5}
                  />
                : null;
            case 'card_payment_promo':
              return home.card_payment_promo.visible
                ? <CardPaymentPromo key={key} config={home.card_payment_promo} />
                : null;
            case 'deals_of_day':
              return home.deals_of_day.visible && (dealsSpotlight || dealsProducts.length > 0)
                ? <DealsOfDay
                    key={key}
                    products={dealsProducts}
                    spotlight={dealsSpotlight}
                    title={home.deals_of_day.title}
                  />
                : null;
            case 'services_row':
              return home.services_row.visible
                ? <ServicesRow key={key} items={home.services_row.items} />
                : null;
            case 'trust_badges':
              return home.trust_badges.visible
                ? <TrustBadges key={key} items={home.trust_badges.items} />
                : null;
            default:
              return null;
          }
        })}
      </main>

      <Footer meta={meta} categories={categories} />
      {meta.messenger?.url && <MessengerCTA href={meta.messenger.url} />}
    </>
  );
}
