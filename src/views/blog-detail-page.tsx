import { Header } from '../components/layout/header';
import { ServiceHeader } from '../components/layout/service-header';
import { Footer } from '../components/layout/footer';
import { NotFoundPage } from './not-found';
import type { BlogPostDetail, Category, StorefrontMeta } from '../lib/types';

/**
 * Blog post detail (/blog/[slug]) — cover + title + date + Markdown body
 * (rendered to sanitized HTML server-side, dropped into a Tailwind `prose`
 * block). Shared by BOTH business types via the header branch. Pure content,
 * no form.
 */
export function BlogDetailPage({
  meta,
  post,
  categories = [],
}: {
  meta: StorefrontMeta | null;
  post: BlogPostDetail | null;
  categories?: Category[];
}) {
  if (!meta || !post) return <NotFoundPage />;

  const isService = meta.business_type === 'service';

  return (
    <>
      {isService ? <ServiceHeader meta={meta} /> : <Header meta={meta} categories={categories} />}

      <main className="mx-auto max-w-[760px] px-4 sm:px-6 py-8 sm:py-12">
        <nav className="text-xs text-slate-500 mb-5">
          <a href="/blog" className="hover:text-slate-700">Blog</a>
          <span className="mx-1.5">/</span>
          <span className="text-slate-700">{post.title}</span>
        </nav>

        <article>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">{post.title}</h1>
          {post.published_at && (
            <time className="mt-3 block text-sm font-medium text-slate-400" dateTime={post.published_at}>{formatDate(post.published_at)}</time>
          )}

          {post.image_url && (
            <img src={post.image_url} alt={post.title} className="mt-6 w-full rounded-2xl object-cover aspect-[16/9] ring-1 ring-slate-200" />
          )}

          {post.body_html ? (
            <div className="prose prose-slate max-w-none mt-8" dangerouslySetInnerHTML={{ __html: post.body_html }} />
          ) : post.excerpt ? (
            <p className="mt-8 text-slate-600 leading-relaxed">{post.excerpt}</p>
          ) : null}
        </article>

        <div className="mt-12 pt-6 border-t border-slate-200">
          <a href="/blog" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to blog
          </a>
        </div>
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
