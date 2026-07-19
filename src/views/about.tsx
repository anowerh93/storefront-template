import { Header } from '../components/layout/header';
import { Footer } from '../components/layout/footer';
import { MessengerCTA } from '../components/layout/messenger-cta';
import { Button } from '../components/ui/button';
import { NotFoundPage } from './not-found';
import { cdnImage, cdnSrcSet } from '../lib/img';
import { CertSlider } from '../components/ui/cert-slider';
import type { StorefrontMeta, TeamMember, Certification } from '../lib/types';

// Astro+CF port: meta + team + certifications arrive as props (fetched in
// src/pages/about.astro). Pure content page → rendered as static HTML, but the
// cert slider hydrates as a client island (client:load on the page).
export function AboutPage({
  meta,
  team = [],
  certifications = [],
}: {
  meta: StorefrontMeta | null;
  team?: TeamMember[];
  certifications?: Certification[];
}) {
  if (!meta) return <NotFoundPage />;
  // Ordered list of About images; fall back to the single-image alias so an
  // older API payload (about_image_url only) still renders one.
  const aboutImages =
    meta.about_image_urls && meta.about_image_urls.length > 0
      ? meta.about_image_urls
      : meta.about_image_url
        ? [meta.about_image_url]
        : [];
  return (
    <>
      <Header meta={meta} />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">{meta.about_title || meta.name}</h1>
        {meta.about_html ? (
          // Sanitized server-side: tenant Markdown → HTML via Markdown::toHtml
          // (raw HTML stripped, unsafe links neutralised) — safe to inject.
          <div
            className="prose prose-slate max-w-none mt-6"
            dangerouslySetInnerHTML={{ __html: meta.about_html }}
          />
        ) : meta.about ? (
          <div className="prose prose-slate max-w-none mt-6">
            <p className="text-base text-slate-700 leading-relaxed whitespace-pre-line">{meta.about}</p>
          </div>
        ) : (
          <p className="text-slate-500 mt-4">More about us coming soon.</p>
        )}

        {/* Optional stacked banners / designed sections — shown AFTER the
            article text so the story leads and the images support it. All
            lazy now they're below the fold (the title/text is the LCP). */}
        {aboutImages.length > 0 && (
          <div className="mt-10 space-y-4">
            {aboutImages.map((url, i) => (
              <img
                key={i}
                src={url}
                srcSet={cdnSrcSet(url)}
                sizes={cdnSrcSet(url) ? '(min-width: 768px) 768px, 100vw' : undefined}
                alt={`${meta.about_title || meta.name} — ${i + 1}`}
                loading="lazy"
                className="w-full rounded-2xl object-cover ring-1 ring-slate-200"
              />
            ))}
          </div>
        )}

        {/* Meet Our Team — structured cards (photo + name + role + bio) */}
        {team.length > 0 && (
          <section className="mt-14">
            <h2 className="text-2xl font-bold text-slate-900">Meet Our Team</h2>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {team.map((m, i) => (
                <div key={i} className="rounded-2xl bg-white p-5 text-center ring-1 ring-slate-200 sm:p-6">
                  {m.image_url ? (
                    <img
                      src={cdnImage(m.image_url, 240)}
                      alt={m.name}
                      loading="lazy"
                      className="mx-auto h-24 w-24 rounded-full object-cover ring-1 ring-slate-200"
                    />
                  ) : (
                    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-brand-50 text-2xl font-bold text-brand-300">
                      {m.name.charAt(0)}
                    </div>
                  )}
                  <h3 className="mt-4 font-bold text-slate-900">{m.name}</h3>
                  {m.role && <p className="text-sm font-medium text-brand-700">{m.role}</p>}
                  {m.bio && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{m.bio}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Certifications — registration / approval scans in a swipeable slider,
            right after the team so the "who we are" story flows into "and here's
            our proof". Filtered to rows that actually have an image. */}
        {(() => {
          const certs = certifications.filter((c) => c.image_url);
          if (certs.length === 0) return null;
          return (
            <section className="mt-14">
              <h2 className="text-2xl font-bold text-slate-900">Our Certifications</h2>
              <p className="mt-1 text-sm text-slate-500">Our registrations &amp; approvals.</p>
              <div className="mt-6">
                <CertSlider items={certs.map((c) => ({ url: c.image_url as string, caption: c.title }))} />
              </div>
            </section>
          );
        })()}

        <div className="mt-12 flex flex-wrap gap-3">
          <a href="/products"><Button variant="brand">Shop our products</Button></a>
          {meta.messenger?.url && (
            <a href={meta.messenger.url} target="_blank" rel="noopener">
              <Button variant="outline">Get in touch</Button>
            </a>
          )}
        </div>
      </main>
      <Footer meta={meta} />
      <MessengerCTA href={meta.messenger?.url ?? null} whatsapp={meta.whatsapp} />
    </>
  );
}
