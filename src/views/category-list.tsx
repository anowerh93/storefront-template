import { FolderOpen, ArrowRight } from 'lucide-react';
import { Header } from '../components/layout/header';
import { Footer } from '../components/layout/footer';
import { MessengerCTA } from '../components/layout/messenger-cta';
import { Button } from '../components/ui/button';
import { NotFoundPage } from './not-found';
import type { Category, StorefrontMeta } from '../lib/types';

// Astro+CF port: meta + categories now arrive as props (fetched in the
// Astro page frontmatter) instead of an internal await. Pure presentational
// component — no interactivity, so the Astro page can render it without
// hydration (static HTML).
export function CategoryListPage({
  meta,
  categories,
}: {
  meta: StorefrontMeta | null;
  categories: Category[];
}) {
  if (!meta) return <NotFoundPage />;

  return (
    <>
      <Header meta={meta} categories={categories} />
      <main className="mx-auto max-w-[1200px] px-4 sm:px-6 py-6 sm:py-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">Browse categories</h1>
        <p className="text-sm text-slate-500 mb-6">
          {categories.length === 0
            ? 'No categories yet.'
            : `${categories.length} ${categories.length === 1 ? 'category' : 'categories'} to explore`}
        </p>

        {categories.length === 0 ? (
          <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-10 text-center">
            <FolderOpen className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-4 font-semibold text-slate-900">Nothing categorised yet</h3>
            <p className="mt-1 text-sm text-slate-500">
              Browse the full catalogue while we tidy things up.
            </p>
            <div className="mt-5">
              <a href="/products">
                <Button variant="brand">View all products</Button>
              </a>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map((c) => (
              <a
                key={c.slug}
                href={`/categories/${c.slug}`}
                className="group relative rounded-2xl bg-gradient-to-br from-brand-50 via-white to-brand-100/50 ring-1 ring-brand-100 hover:ring-brand-300 hover:shadow-lg transition p-5 overflow-hidden"
              >
                <div className="absolute top-3 right-3 h-8 w-8 rounded-full bg-brand-500/10 group-hover:bg-brand-500 transition flex items-center justify-center">
                  <ArrowRight className="h-4 w-4 text-brand-600 group-hover:text-white transition" />
                </div>
                {c.image_url && (
                  <img src={c.image_url} alt={c.name} loading="lazy"
                       className="h-12 w-12 object-contain rounded-lg mb-3" />
                )}
                <h3 className="font-semibold text-slate-900 group-hover:text-brand-700 transition pr-8">{c.name}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {c.product_count} {c.product_count === 1 ? 'product' : 'products'}
                </p>
              </a>
            ))}
          </div>
        )}
      </main>
      <Footer meta={meta} />
      <MessengerCTA href={meta.messenger?.url ?? null} whatsapp={meta.whatsapp} />
    </>
  );
}
