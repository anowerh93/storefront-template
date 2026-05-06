/**
 * Catch-all page entry — re-exported by the tenant's thin shell as
 * `app/[[...slug]]/page.tsx`. This single file routes ALL storefront URLs
 * to the right page component based on path segments.
 *
 * Why a catch-all: it lets us own routing inside this package, so when we
 * add a new page (e.g. /search, /wishlist) tenants just bump the package
 * version and redeploy — no new files in their thin shell.
 *
 * Routes handled:
 *   /                        → HomePage
 *   /products                → ProductListPage
 *   /products/{slug}         → ProductDetailPage
 *   /categories              → CategoryListPage
 *   /categories/{slug}       → CategoryDetailPage
 *   (no /cart, no /checkout — orders are placed inline on the PDP via
 *    <OrderNowForm /> which posts straight to /api/v1/.../orders)
 *   /order/lookup            → OrderLookupPage
 *   /order/{number}          → OrderStatusPage
 *   /about                   → AboutPage
 *   anything else            → NotFoundPage
 */

import { HomePage } from './views/home';
import { ProductListPage } from './views/product-list';
import { ProductDetailPage } from './views/product-detail';
import { CategoryListPage } from './views/category-list';
import { CategoryDetailPage } from './views/category-detail';
import { OrderLookupPage } from './views/order-lookup';
import { OrderStatusPage } from './views/order-status';
import { AboutPage } from './views/about';
import { NotFoundPage } from './views/not-found';

type PageProps = {
  params?: Promise<{ slug?: string[] }>;
  searchParams?: Promise<Record<string, string | undefined>>;
};

export async function Page({ params, searchParams }: PageProps) {
  const p   = (await params)?.slug ?? [];
  const qs  = (await searchParams) ?? {};

  // Root
  if (p.length === 0) return <HomePage />;

  const [seg0, seg1] = p;

  if (seg0 === 'products' && !seg1) return <ProductListPage searchParams={qs} />;
  if (seg0 === 'products' && seg1)  return <ProductDetailPage slug={seg1} />;

  if (seg0 === 'categories' && !seg1) return <CategoryListPage />;
  if (seg0 === 'categories' && seg1)  return <CategoryDetailPage slug={seg1} searchParams={qs} />;

  if (seg0 === 'order' && (seg1 === 'lookup' || !seg1)) return <OrderLookupPage />;
  if (seg0 === 'order' && seg1) {
    return <OrderStatusPage orderNumber={seg1} searchParams={qs as { phone?: string; placed?: string }} />;
  }

  if (seg0 === 'about') return <AboutPage />;

  return <NotFoundPage />;
}

export default Page;

// Per-route metadata generation. Next requires this be exportable from the
// page file when the route uses dynamic SEO; we delegate to layout-level
// metadata for the common case and only override for product detail (where
// the API gives us per-product SEO).
export async function generateMetadata({ params }: PageProps) {
  const p = (await params)?.slug ?? [];
  if (p[0] === 'products' && p[1]) {
    try {
      const { getProduct } = await import('./lib/api');
      const prod = await getProduct(p[1]);
      return {
        title: prod.seo.title ?? prod.name,
        description: prod.seo.description ?? prod.short_description ?? prod.name,
        openGraph: {
          title: prod.seo.title ?? prod.name,
          description: prod.seo.description ?? prod.short_description ?? undefined,
          images: prod.seo.og_image ? [{ url: prod.seo.og_image }] : prod.image_url ? [{ url: prod.image_url }] : undefined,
        },
      };
    } catch {
      return {};
    }
  }
  return {};
}

// Static-params hook the thin shell can re-export so Next ISR pre-renders
// the most common routes at build time.
export async function generateStaticParams() {
  // Pre-render the home page only at build; product/category pages are
  // generated on-demand and cached via ISR (60s revalidate) + tag-based
  // invalidation from the Laravel webhook.
  return [{ slug: [] }];
}
