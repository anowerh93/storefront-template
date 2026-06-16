import { Header } from '../components/layout/header';
import { ServiceHeader } from '../components/layout/service-header';
import { Footer } from '../components/layout/footer';
import { NotFoundPage } from './not-found';
import type { BlogPostCard, Category, Paginated, StorefrontMeta } from '../lib/types';

/**
 * Blog listing (/blog) — a grid of post cards, paginated. Shared by BOTH
 * business types: e-commerce tenants get the shop Header, service tenants the
 * ServiceHeader. Pure content; pagination is native <a> links (work without JS).
 */
export function BlogListPage({
  meta,
  posts,
  categories = [],
}: {
  meta: StorefrontMeta | null;
  posts: Paginated<BlogPostCard> | null;
  categories?: Category[];
}) {
  if (!meta) return <NotFoundPage />;

  const isService = meta.business_type === 'service';
  const items = posts?.data ?? [];
  const page = posts?.meta.current_page ?? 1;
  const lastPage = posts?.meta.last_page ?? 1;

  return (
    <>
      {isService ? <ServiceHeader meta={meta} /> : <Header meta={meta} categories={categories} />}

      <main className="mx-auto max-w-[1100px] px-4 sm:px-6 py-12 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">Blog</h1>
        <p className="mt-2 text-slate-600">News, guides and updates from {meta.name}.</p>

        {items.length === 0 ? (
          <p className="mt-10 text-slate-500">No posts yet — check back soon.</p>
        ) : (
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((p) => (
              <a key={p.slug} href={`/blog/${p.slug}`}
                 className="group flex flex-col bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden hover:shadow-md hover:ring-brand-300 transition">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.title} loading="lazy" className="w-full aspect-[16/9] object-cover" />
                ) : (
                  <div className="w-full aspect-[16/9] bg-brand-50" />
                )}
                <div className="p-5 flex flex-col flex-1">
                  {p.published_at && (
                    <time className="text-xs font-medium text-slate-400" dateTime={p.published_at}>{formatDate(p.published_at)}</time>
                  )}
                  <h2 className="mt-1 font-bold text-slate-900 group-hover:text-brand-700 transition leading-snug">{p.title}</h2>
                  {p.excerpt && <p className="mt-1.5 text-sm text-slate-600 leading-relaxed line-clamp-3">{p.excerpt}</p>}
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
                    Read more
                    <svg className="w-4 h-4 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}

        {lastPage > 1 && (
          <div className="mt-10 flex items-center justify-center gap-3">
            {page > 1 && (
              <a href={`/blog?page=${page - 1}`} className="px-4 py-2 rounded-lg ring-1 ring-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50">← Newer</a>
            )}
            <span className="text-sm text-slate-500">Page {page} of {lastPage}</span>
            {page < lastPage && (
              <a href={`/blog?page=${page + 1}`} className="px-4 py-2 rounded-lg ring-1 ring-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50">Older →</a>
            )}
          </div>
        )}
      </main>

      <Footer meta={meta} categories={categories} />
    </>
  );
}

/** Format an ISO date as "Jun 16, 2026" without locale-data surprises on Workers. */
function formatDate(iso: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
