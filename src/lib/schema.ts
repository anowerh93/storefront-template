/**
 * Hand-rolled JSON-LD builders (schema.org structured data).
 *
 * No library: tenant catalogs need ~6 types (Product, BreadcrumbList,
 * Store/LocalBusiness, WebSite, FAQPage, CollectionPage), and a builder
 * function per type keeps the payload auditable — what we emit is exactly
 * what's written here.
 *
 * Conventions:
 *   - Builders return plain objects; Base.astro serialises them into
 *     <script type="application/ld+json"> (with `<` escaped so user
 *     content can never close the script tag).
 *   - `compact()` drops empty values so optional tenant fields (brand,
 *     location, socials) silently disappear instead of emitting nulls.
 *   - Rich-text fields are stripped to plain text — Google ignores or
 *     penalises markup inside structured data strings.
 *   - Copy promise: structured data makes pages ELIGIBLE for rich
 *     results; never present it as a guarantee.
 */

import type { ProductDetail, StorefrontMeta } from './types';

export type Schema = Record<string, unknown>;

/** Strip HTML tags + collapse whitespace (rich-text answers, markdown HTML). */
export const plainText = (s: string | null | undefined): string =>
  (s ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/** Drop null / undefined / '' / empty-array values, recursively-shallow. */
const compact = (obj: Schema): Schema => {
  const out: Schema = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
};

// ──────────────────────────────────────────────────────────────
// Product (PDP) — name, images, offer, ratings + top reviews
// ──────────────────────────────────────────────────────────────

export function productSchema(product: ProductDetail, url: string): Schema {
  const images = [product.image_url, ...(product.gallery_urls ?? [])]
    .filter((u): u is string => !!u)
    .filter((u, i, arr) => arr.indexOf(u) === i);

  const description =
    product.seo?.description ||
    plainText(product.description_html).slice(0, 300) ||
    product.name;

  const rating =
    product.reviews.count > 0 && product.reviews.average != null
      ? {
          '@type': 'AggregateRating',
          ratingValue: product.reviews.average,
          reviewCount: product.reviews.count,
        }
      : undefined;

  const reviews = (product.reviews.items ?? []).slice(0, 5).map((r) =>
    compact({
      '@type': 'Review',
      author: { '@type': 'Person', name: r.author_name || 'Customer' },
      reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 },
      reviewBody: plainText(r.body),
      datePublished: r.created_at ? r.created_at.slice(0, 10) : undefined,
    }),
  );

  return compact({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    url,
    image: images,
    description,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    offers: compact({
      '@type': 'Offer',
      url,
      price: product.price.toFixed(2),
      priceCurrency: product.currency || 'BDT',
      availability: product.in_stock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    }),
    aggregateRating: rating,
    review: reviews,
  });
}

// ──────────────────────────────────────────────────────────────
// BreadcrumbList — last item is the current page (no URL needed)
// ──────────────────────────────────────────────────────────────

export function breadcrumbSchema(items: { name: string; url?: string }[]): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) =>
      compact({
        '@type': 'ListItem',
        position: i + 1,
        name: plainText(item.name),
        item: item.url,
      }),
    ),
  };
}

// ──────────────────────────────────────────────────────────────
// Organization — Store (ecommerce) / LocalBusiness (service)
// ──────────────────────────────────────────────────────────────

export function orgSchema(meta: StorefrontMeta, origin: string): Schema {
  const sameAs = Object.values((meta.social_links ?? {}) as Record<string, string>).filter(
    (u) => typeof u === 'string' && u !== '',
  );

  return compact({
    '@context': 'https://schema.org',
    '@type': meta.business_type === 'service' ? 'LocalBusiness' : 'Store',
    name: meta.name,
    url: origin,
    logo: meta.logo_url ?? undefined,
    image: meta.logo_url ?? undefined,
    description: plainText(meta.seo?.description ?? meta.about).slice(0, 300) || undefined,
    telephone: meta.whatsapp ?? undefined,
    email: meta.email ?? undefined,
    address: meta.location
      ? {
          '@type': 'PostalAddress',
          addressLocality: meta.location,
          addressCountry: 'BD',
        }
      : undefined,
    sameAs,
  });
}

// ──────────────────────────────────────────────────────────────
// WebSite — names the site in search + sitelinks-searchbox eligible
// ──────────────────────────────────────────────────────────────

export function websiteSchema(meta: StorefrontMeta, origin: string): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: meta.name,
    url: origin,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${origin}/products?search={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

// ──────────────────────────────────────────────────────────────
// FAQPage — product funnel FAQ / service-site FAQ block
// ──────────────────────────────────────────────────────────────

export function faqSchema(items: { q: string; a: string }[]): Schema | null {
  const qa = items
    .map((f) => ({ q: plainText(f.q), a: plainText(f.a) }))
    .filter((f) => f.q !== '' && f.a !== '');
  if (qa.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qa.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

// ──────────────────────────────────────────────────────────────
// CollectionPage — category listing pages
// ──────────────────────────────────────────────────────────────

export function collectionPageSchema(
  category: { name: string; description?: string | null; seo_description?: string | null },
  url: string,
): Schema {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: category.name,
    url,
    description:
      plainText(category.seo_description ?? category.description).slice(0, 300) || undefined,
  });
}
