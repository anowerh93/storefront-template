import { Search, X, PackageX } from 'lucide-react';
import { getProducts, getStorefront, getCategories, type ProductSort } from '../lib/api';
import { Header } from '../components/layout/header';
import { Footer } from '../components/layout/footer';
import { MessengerCTA } from '../components/layout/messenger-cta';
import { ProductGrid } from '../components/product/product-grid';
import { SortDropdown } from '../components/product/sort-dropdown';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

export async function ProductListPage({
  searchParams,
}: {
  searchParams?: { search?: string; category?: string; page?: string; sort?: string };
}) {
  const page     = parseInt(searchParams?.page ?? '1', 10);
  const search   = searchParams?.search ?? '';
  const category = searchParams?.category ?? '';
  const sort     = (searchParams?.sort ?? 'newest') as ProductSort;

  const [meta, productsRes, categories] = await Promise.all([
    getStorefront(),
    getProducts({ page, perPage: 24, search, category, sort }),
    getCategories().catch(() => []),
  ]);

  const total       = productsRes.meta.total;
  const lastPage    = productsRes.meta.last_page;
  const activeCat   = categories.find((c) => c.slug === category);
  const hasFilters  = !!(search || category);

  const buildHref = (overrides: Partial<{ search: string; category: string; page: number; sort: string }>) => {
    const merged = {
      search:   overrides.search   ?? search,
      category: overrides.category ?? category,
      page:     overrides.page     ?? 1,
      sort:     overrides.sort     ?? sort,
    };
    const params = new URLSearchParams();
    if (merged.search)              params.set('search', merged.search);
    if (merged.category)            params.set('category', merged.category);
    if (merged.page > 1)            params.set('page', merged.page.toString());
    if (merged.sort && merged.sort !== 'newest') params.set('sort', merged.sort);
    const qs = params.toString();
    return '/products' + (qs ? `?${qs}` : '');
  };

  return (
    <>
      <Header meta={meta} categories={categories} />

      <main className="mx-auto max-w-[1200px] px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex items-end justify-between mb-5 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">All products</h1>
            <p className="text-sm text-slate-500 mt-1">{total} {total === 1 ? 'product' : 'products'}</p>
          </div>
          <SortDropdown current={sort} basePath="/products" />
        </div>

        {/* Search + filter bar */}
        <form action="/products" method="get" className="mb-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="search"
              name="search"
              defaultValue={search}
              placeholder="Search products…"
              className="pl-10"
            />
          </div>
          {category && <input type="hidden" name="category" value={category} />}
          {sort && sort !== 'newest' && <input type="hidden" name="sort" value={sort} />}
          <Button type="submit" variant="brand">Search</Button>
        </form>

        {/* Active filter chips */}
        {hasFilters && (
          <div className="mb-5 flex items-center gap-2 flex-wrap text-sm">
            <span className="text-xs text-slate-500 font-medium">Filters:</span>
            {search && (
              <a
                href={buildHref({ search: '' })}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition text-xs font-medium"
              >
                Search: &ldquo;{search}&rdquo;
                <X className="h-3 w-3" />
              </a>
            )}
            {activeCat && (
              <a
                href={buildHref({ category: '' })}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-100 text-brand-700 hover:bg-brand-200 transition text-xs font-medium"
              >
                Category: {activeCat.name}
                <X className="h-3 w-3" />
              </a>
            )}
            <a
              href="/products"
              className="text-xs text-slate-500 hover:text-slate-900 underline underline-offset-2 ml-1"
            >
              Clear all
            </a>
          </div>
        )}

        <div className="grid lg:grid-cols-[220px_1fr] gap-6">
          {/* Categories sidebar (desktop) */}
          <aside className="hidden lg:block space-y-1">
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-3">Categories</p>
            <a
              href={buildHref({ category: '' })}
              className={`block px-3 py-2 rounded-lg text-sm transition ${!category ? 'bg-brand-50 text-brand-700 font-medium' : 'text-slate-700 hover:bg-slate-100'}`}
            >
              All products
            </a>
            {categories.map((c) => (
              <a
                key={c.slug}
                href={buildHref({ category: c.slug })}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${category === c.slug ? 'bg-brand-50 text-brand-700 font-medium' : 'text-slate-700 hover:bg-slate-100'}`}
              >
                <span>{c.name}</span>
                <span className="text-xs text-slate-400">{c.product_count}</span>
              </a>
            ))}
          </aside>

          {/* Grid */}
          <div>
            {/* Mobile category chips */}
            <div className="lg:hidden mb-4 flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
              <a
                href={buildHref({ category: '' })}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${!category ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                All
              </a>
              {categories.map((c) => (
                <a
                  key={c.slug}
                  href={buildHref({ category: c.slug })}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${category === c.slug ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
                >
                  {c.name}
                </a>
              ))}
            </div>

            {/* Empty state — no results for filters */}
            {productsRes.data.length === 0 && hasFilters ? (
              <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-10 text-center">
                <PackageX className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-4 font-semibold text-slate-900">No matches</h3>
                <p className="mt-1 text-sm text-slate-500">
                  We couldn&rsquo;t find anything for that combination.
                </p>
                <div className="mt-5">
                  <a href="/products">
                    <Button variant="brand">View all products</Button>
                  </a>
                </div>
              </div>
            ) : (
              <ProductGrid products={productsRes.data} />
            )}

            {/* Pagination */}
            {lastPage > 1 && (
              <nav className="mt-10 flex items-center justify-center gap-1.5">
                {page > 1 && (
                  <a href={buildHref({ page: page - 1 })} className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100">
                    ← Prev
                  </a>
                )}
                {Array.from({ length: lastPage }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === lastPage || Math.abs(p - page) <= 1)
                  .map((p, idx, arr) => (
                    <span key={p} className="contents">
                      {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-slate-400">…</span>}
                      <a
                        href={buildHref({ page: p })}
                        className={`px-3 py-2 rounded-lg text-sm font-medium ${p === page ? 'bg-brand-500 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
                      >
                        {p}
                      </a>
                    </span>
                  ))}
                {page < lastPage && (
                  <a href={buildHref({ page: page + 1 })} className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100">
                    Next →
                  </a>
                )}
              </nav>
            )}
          </div>
        </div>
      </main>

      <Footer meta={meta} />
      <MessengerCTA href={meta.messenger?.url ?? null} />
    </>
  );
}
