import { useEffect } from 'react';
import { PackageX } from 'lucide-react';
import { type ProductSort } from '../lib/api';
import { pixel } from '../lib/pixel';
import { Header } from '../components/layout/header';
import { Footer } from '../components/layout/footer';
import { MessengerCTA } from '../components/layout/messenger-cta';
import { ProductGrid } from '../components/product/product-grid';
import { SortDropdown } from '../components/product/sort-dropdown';
import { Button } from '../components/ui/button';
import { NotFoundPage } from './not-found';
import type { Category, Paginated, ProductCard, StorefrontMeta } from '../lib/types';

/**
 * Astro+CF port: was async (fetched category+products+meta). The Astro page
 * (src/pages/categories/[slug].astro) does the fetch and passes `res` in;
 * a null res (category 404 or fetch error) renders NotFoundPage in-place.
 * Rendered as a client island because SortDropdown needs hydration.
 */
export function CategoryDetailPage({
  searchParams,
  res,
  meta,
  categories,
}: {
  searchParams?: { sort?: string; page?: string };
  res: { category: Category; products: Paginated<ProductCard> } | null;
  meta: StorefrontMeta | null;
  categories: Category[];
}) {
  // GA4 view_item_list — hook sits above the early return (rules of hooks).
  // Re-fires on sort/page navigation, which is a fresh page load here (MPA).
  useEffect(() => {
    const list = res?.products?.data ?? [];
    if (res && list.length > 0) {
      pixel.viewItemList({
        listName: res.category.name,
        items: list.map((p) => ({ item_id: p.id.toString(), item_name: p.name, price: p.price, quantity: 1 })),
      });
    }
  }, []);

  if (!res || !meta) return <NotFoundPage />;

  const sort = (searchParams?.sort ?? 'newest') as ProductSort;
  const page = parseInt(searchParams?.page ?? '1', 10);
  const { category, products } = res;

  return (
    <>
      <Header meta={meta} categories={categories} />
      <main className="mx-auto max-w-[1200px] px-4 sm:px-6 py-6 sm:py-10">
        <nav className="text-xs text-slate-500 mb-4">
          <a href="/" className="hover:text-brand-600">Home</a>
          <span className="mx-2">/</span>
          <a href="/categories" className="hover:text-brand-600">Categories</a>
          <span className="mx-2">/</span>
          <span className="text-slate-700">{category.name}</span>
        </nav>

        <div className="flex items-end justify-between gap-3 mb-6 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{category.name}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {products.meta.total} {products.meta.total === 1 ? 'product' : 'products'}
            </p>
          </div>
          {products.data.length > 0 && (
            <SortDropdown current={sort} basePath={`/categories/${category.slug}`} />
          )}
        </div>

        {products.data.length === 0 ? (
          <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-10 text-center">
            <PackageX className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-4 font-semibold text-slate-900">Nothing here yet</h3>
            <p className="mt-1 text-sm text-slate-500">
              We&rsquo;re still adding products to this category.
            </p>
            <div className="mt-5">
              <a href="/products">
                <Button variant="brand">Browse all products</Button>
              </a>
            </div>
          </div>
        ) : (
          <ProductGrid products={products.data} />
        )}
      </main>
      <Footer meta={meta} />
      <MessengerCTA href={meta.messenger?.url ?? null} whatsapp={meta.whatsapp} />
    </>
  );
}
