import { Header } from '../components/layout/header';
import { ServiceHeader } from '../components/layout/service-header';
import { Footer } from '../components/layout/footer';
import { NotFoundPage } from './not-found';
import type { InfoPageDetail, Category, StorefrontMeta } from '../lib/types';

/**
 * Default info page (/pages/[slug]) — Terms / Privacy / Refund / Careers.
 * Title + Markdown body (rendered to sanitized HTML server-side, dropped into
 * a Tailwind `prose` block). Shared by BOTH business types via the header
 * branch. Pure content, no form.
 */
export function InfoPageView({
  meta,
  page,
  categories = [],
}: {
  meta: StorefrontMeta | null;
  page: InfoPageDetail | null;
  categories?: Category[];
}) {
  if (!meta || !page) return <NotFoundPage />;

  const isService = meta.business_type === 'service';

  return (
    <>
      {isService ? <ServiceHeader meta={meta} /> : <Header meta={meta} categories={categories} />}

      <main className="mx-auto max-w-[760px] px-4 sm:px-6 py-8 sm:py-12">
        <nav className="text-xs text-slate-500 mb-5">
          <a href="/" className="hover:text-slate-700">Home</a>
          <span className="mx-1.5">/</span>
          <span className="text-slate-700">{page.title}</span>
        </nav>

        <article>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">{page.title}</h1>

          {page.body_html && (
            <div className="prose prose-slate max-w-none mt-8" dangerouslySetInnerHTML={{ __html: page.body_html }} />
          )}
        </article>
      </main>

      <Footer meta={meta} categories={categories} />
    </>
  );
}
