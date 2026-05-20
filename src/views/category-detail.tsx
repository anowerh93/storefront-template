import { PackageX } from 'lucide-react';
import { getCategory, getStorefront, getCategories, type ProductSort } from '../lib/api';
import { Header } from '../components/layout/header';
import { Footer } from '../components/layout/footer';
import { MessengerCTA } from '../components/layout/messenger-cta';
import { ProductGrid } from '../components/product/product-grid';
import { SortDropdown } from '../components/product/sort-dropdown';
import { Button } from '../components/ui/button';
import { NotFoundPage } from './not-found';

export async function CategoryDetailPage({
  slug,
  searchParams,
}: {
  slug: string;
  searchParams?: { sort?: string; page?: string };
}) {
  const sort = (searchParams?.sort ?? 'newest') as ProductSort;
  const page = parseInt(searchParams?.page ?? '1', 10);

  let res;
  try {
    res = await getCategory(slug, { sort, page });
  } catch {
    // notFound() → NotFoundPage render. See product-detail.tsx for rationale.
    return <NotFoundPage />;
  }
  const [meta, categories] = await Promise.all([getStorefront(), getCategories().catch(() => [])]);
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
            <SortDropdown current={sort} basePath={`/categories/${slug}`} />
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
      <MessengerCTA href={meta.messenger?.url ?? null} />
    </>
  );
}
