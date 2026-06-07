import { getStorefront, getProducts, getCategories } from '../lib/api';
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
import type { ProductCard, HomepageSectionKey } from '../lib/types';

/**
 * Homepage. Section render order is driven by `meta.homepage.section_order`,
 * which the tenant rearranges via up/down arrows in the dashboard. Each
 * section also reads its own visibility + content from the config.
 */
export async function HomePage() {
  const [meta, productsRes, categories] = await Promise.all([
    getStorefront(),
    getProducts({ perPage: 100 }),
    getCategories().catch(() => []),
  ]);

  const all = productsRes.data;
  const home = meta.homepage;
  const byId = new Map(all.map((p) => [p.id, p]));

  const resolve = (ids: number[]): ProductCard[] =>
    ids.map((id) => byId.get(id)).filter(Boolean) as ProductCard[];

  const heroProducts        = resolve(home.hero.product_ids);
  const featureProducts     = resolve(home.feature_products.product_ids);
  const trendingProducts    = resolve(home.trending_products.product_ids);
  const mostSellingProducts = resolve(home.most_selling.product_ids);
  const dealsProducts       = resolve(home.deals_of_day.product_ids);

  const promoRowItems = home.promo_row.cards
    .map((card) => {
      const p = card.product_id ? byId.get(card.product_id) : null;
      return p ? { card, product: p } : null;
    })
    .filter(Boolean) as { card: typeof home.promo_row.cards[number]; product: ProductCard }[];

  const order: HomepageSectionKey[] = home.section_order?.length
    ? home.section_order
    : [
        'hero', 'categories', 'feature_products', 'promo_row',
        'trending_products', 'brand_strip', 'promo_banner',
        'most_selling', 'card_payment_promo', 'deals_of_day',
        'services_row', 'trust_badges',
      ];

  const renderSection = (key: HomepageSectionKey) => {
    switch (key) {
      case 'hero':
        return home.hero.visible && heroProducts.length > 0
          ? <HeroGrid key="hero" featured={heroProducts} hero={home.hero} />
          : null;
      case 'categories':
        return home.categories.visible
          ? <CategoryStrip key="categories" categories={categories} title={home.categories.title} />
          : null;
      case 'feature_products':
        return home.feature_products.visible && featureProducts.length > 0
          ? <ProductRow key="feature_products"
              title={home.feature_products.title}
              subtitle={home.feature_products.subtitle}
              products={featureProducts} cols={5} />
          : null;
      case 'promo_row':
        return home.promo_row.visible && promoRowItems.length === 3
          ? <PromoRow key="promo_row"
              products={promoRowItems.map((x) => x.product)}
              cards={promoRowItems.map((x) => x.card)} />
          : null;
      case 'trending_products':
        return home.trending_products.visible && trendingProducts.length > 0
          ? <ProductRow key="trending_products"
              title={home.trending_products.title}
              subtitle={home.trending_products.subtitle}
              products={trendingProducts} cols={5} />
          : null;
      case 'brand_strip':
        return home.brand_strip.visible
          ? <BrandStrip key="brand_strip" items={home.brand_strip.items} />
          : null;
      case 'promo_banner':
        return home.promo_banner.visible
          ? <PromoBanner key="promo_banner" config={home.promo_banner} />
          : null;
      case 'most_selling':
        return home.most_selling.visible && mostSellingProducts.length > 0
          ? <ProductRow key="most_selling"
              title={home.most_selling.title}
              subtitle={home.most_selling.subtitle}
              products={mostSellingProducts} cols={5} />
          : null;
      case 'card_payment_promo':
        return home.card_payment_promo.visible
          ? <CardPaymentPromo key="card_payment_promo" config={home.card_payment_promo} />
          : null;
      case 'deals_of_day': {
        const spotlight = home.deals_of_day.spotlight_id ? byId.get(home.deals_of_day.spotlight_id) ?? null : null;
        return home.deals_of_day.visible && (spotlight || dealsProducts.length > 0)
          ? <DealsOfDay key="deals_of_day"
              products={dealsProducts}
              spotlight={spotlight}
              title={home.deals_of_day.title} />
          : null;
      }
      case 'services_row':
        return home.services_row.visible
          ? <ServicesRow key="services_row" items={home.services_row.items} />
          : null;
      case 'trust_badges':
        return home.trust_badges.visible
          ? <TrustBadges key="trust_badges" items={home.trust_badges.items} />
          : null;
      default:
        return null;
    }
  };

  return (
    <>
      <Header meta={meta} categories={categories} />
      <main className="pb-12">
        {order.map(renderSection)}
      </main>
      <Footer meta={meta} categories={categories} />
      <MessengerCTA href={meta.messenger?.url ?? null} />
    </>
  );
}
