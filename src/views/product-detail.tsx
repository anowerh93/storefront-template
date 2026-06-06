import { useState } from 'react';
import { Star, Truck, ShieldCheck, MessageCircle } from 'lucide-react';
import { formatBDT, discountPct } from '../lib/format';
import { Header } from '../components/layout/header';
import { Footer } from '../components/layout/footer';
import { MessengerCTA } from '../components/layout/messenger-cta';
import { CodBadge } from '../components/layout/cod-badge';
import { ProductGrid } from '../components/product/product-grid';
import { Badge } from '../components/ui/badge';
import { FitImage } from '../components/ui/fit-image';
import { Separator } from '../components/ui/separator';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../components/ui/accordion';
import { OrderNowForm } from '../components/product/order-now-form';
import { NotFoundPage } from './not-found';
import type { ProductDetail, StorefrontMeta } from '../lib/types';

/**
 * Product detail page. The OrderNowForm inside this tree is what places
 * the order — that's why ProductDetailPage hydrates as a client:load
 * React island. The whole tree (Header + content + Footer) hydrates so
 * the form's React state, validation, and submit flow have everything
 * they need; that's a bigger JS bundle than strictly necessary but
 * matches what the old Next.js version was shipping anyway.
 *
 * Astro+CF port: previously this was a Next.js Server Component that did
 * its own `await getProduct(slug)`. Astro renders client islands as
 * sync React components, so the fetch moved up into the Astro page
 * frontmatter (src/pages/products/[slug].astro) which passes results in
 * as props. NotFoundPage rendering is still self-contained — when the
 * Astro page can't find the product it passes `product={null}` and we
 * render the 404 view in-place.
 */
export function ProductDetailPage({
  product,
  meta,
}: {
  product: ProductDetail | null;
  meta: StorefrontMeta | null;
}) {
  // Either fetch failed (product) or storefront meta missing → 404 page.
  if (!product || !meta) return <NotFoundPage />;

  // Use the conversion-focused funnel layout ONLY when the merchant actually
  // configured funnel content. The API always returns a funnel object (even
  // empty), so a bare `!!product.funnel` made EVERY product funnel and hid the
  // richer standard layout (gallery + reviews + related).
  const f = product.funnel;
  const isFunnel = !!(f && (f.headline || f.subheadline || (f.benefits?.length ?? 0) > 0 || (f.faq?.length ?? 0) > 0));
  const discount = discountPct(product.price, product.compare_at_price);

  return (
    <>
      <Header meta={meta} />

      {/* ───────────────────────── Standard layout ───────────────────────── */}
      {!isFunnel && (
        <main className="mx-auto max-w-[1200px] px-4 sm:px-6 pt-6 pb-16">
          {/* Breadcrumb */}
          <nav className="text-xs text-slate-500 mb-4">
            <a href="/" className="hover:text-brand-600">Home</a>
            <span className="mx-2">/</span>
            <a href="/products" className="hover:text-brand-600">Shop</a>
            <span className="mx-2">/</span>
            <span className="text-slate-700">{product.name}</span>
          </nav>

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
            {/* Gallery */}
            <ProductGallery product={product} />

            {/* Buy box */}
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">{product.name}</h1>
                {product.short_description && (
                  <p className="text-sm text-slate-600 mt-2">{product.short_description}</p>
                )}
              </div>

              {/* Rating */}
              {(product.rating_count ?? 0) > 0 && product.rating_avg != null && (
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex items-center gap-0.5">
                    {[1,2,3,4,5].map((n) => (
                      <Star
                        key={n}
                        className={`h-4 w-4 ${n <= Math.round(product.rating_avg!) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                      />
                    ))}
                  </div>
                  <span className="font-semibold text-slate-900">{product.rating_avg.toFixed(1)}</span>
                  <span className="text-slate-500">({product.rating_count} reviews)</span>
                </div>
              )}

              {/* Price */}
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-3xl font-bold text-slate-900">{formatBDT(product.price, { currency: product.currency })}</span>
                {product.compare_at_price && product.compare_at_price > product.price && (
                  <>
                    <span className="text-base text-slate-400 line-through">{formatBDT(product.compare_at_price, { currency: product.currency })}</span>
                    <Badge variant="danger">Save {discount}%</Badge>
                  </>
                )}
              </div>

              {/* COD + delivery info */}
              <div className="flex flex-wrap gap-2">
                <CodBadge size="lg" />
                {meta.shipping?.free_shipping_threshold && product.price >= meta.shipping.free_shipping_threshold && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-50 border border-brand-200">
                    <Truck className="h-4 w-4 text-brand-700" />
                    <span className="text-sm font-semibold text-brand-800">Free shipping</span>
                  </div>
                )}
              </div>

              <Separator />

              {/* Add to cart */}
              <OrderNowForm product={product} meta={meta} />

              {/* Trust signals */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <TrustItem icon={Truck} title="Cash on Delivery" body="Pay when you receive" />
                <TrustItem icon={ShieldCheck} title="Genuine product" body="100% authentic" />
                <TrustItem icon={MessageCircle} title="Easy support" body="We respond within an hour" />
              </div>

              {/* Description */}
              {product.description && (
                <Accordion type="single" collapsible defaultValue="description">
                  <AccordionItem value="description">
                    <AccordionTrigger>Description</AccordionTrigger>
                    <AccordionContent>
                      <div className="prose prose-sm max-w-none text-slate-600 whitespace-pre-line">
                        {product.description}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
            </div>
          </div>

          {/* Reviews */}
          {(product.reviews?.items?.length ?? 0) > 0 && (
            <section className="mt-14">
              <h2 className="text-xl font-bold text-slate-900 mb-5">Customer reviews</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {product.reviews.items.slice(0, 6).map((r) => (
                  <article key={r.id} className="rounded-2xl bg-white ring-1 ring-slate-200 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center gap-0.5">
                        {[1,2,3,4,5].map((n) => (
                          <Star key={n} className={`h-3.5 w-3.5 ${n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                        ))}
                      </div>
                      <span className="text-sm font-medium text-slate-900">{r.author}</span>
                    </div>
                    {r.title && <p className="text-sm font-semibold text-slate-900 mb-1">{r.title}</p>}
                    <p className="text-sm text-slate-600 leading-relaxed">{r.body}</p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Related */}
          {(product.related_products?.length ?? 0) > 0 && (
            <section className="mt-14">
              <h2 className="text-xl font-bold text-slate-900 mb-5">You may also like</h2>
              <ProductGrid products={product.related_products} />
            </section>
          )}
        </main>
      )}

      {/* ───────────────────────── Funnel layout ───────────────────────── */}
      {isFunnel && (
        <main className="bg-white">
          {/* Hero */}
          <section className="bg-gradient-to-br from-brand-50 via-white to-brand-50/40">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16 text-center">
              <h1 className="text-3xl sm:text-5xl font-bold text-slate-900 leading-tight tracking-tight">
                {product.funnel?.headline ?? product.name}
              </h1>
              {product.funnel?.subheadline && (
                <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">{product.funnel.subheadline}</p>
              )}
              {(product.rating_count ?? 0) > 0 && product.rating_avg != null && (
                <div className="mt-5 flex items-center justify-center gap-2 text-sm">
                  <div className="flex items-center gap-0.5">
                    {[1,2,3,4,5].map((n) => (
                      <Star key={n} className={`h-4 w-4 ${n <= Math.round(product.rating_avg!) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                    ))}
                  </div>
                  <span className="font-semibold text-slate-900">{product.rating_avg.toFixed(1)}</span>
                  <span className="text-slate-500">({product.rating_count} reviews)</span>
                </div>
              )}
              <div className="mt-6 flex justify-center">
                <CodBadge size="lg" />
              </div>
            </div>
          </section>

          {/* Hero image gallery */}
          <FunnelGallery product={product} />

          {/* Buy block */}
          <section id="buy" className="mx-auto max-w-3xl px-4 sm:px-6 mt-10 scroll-mt-20">
            <div className="rounded-3xl bg-white ring-1 ring-slate-200 p-6 sm:p-8 shadow-sm">
              <div className="flex items-baseline gap-3 flex-wrap mb-4">
                <span className="text-3xl font-bold text-slate-900">{formatBDT(product.price, { currency: product.currency })}</span>
                {product.compare_at_price && product.compare_at_price > product.price && (
                  <>
                    <span className="text-base text-slate-400 line-through">{formatBDT(product.compare_at_price, { currency: product.currency })}</span>
                    <Badge variant="danger">Save {discount}%</Badge>
                  </>
                )}
              </div>
              <OrderNowForm product={product} meta={meta} />
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-5 border-t border-slate-100 text-xs">
                <TrustItem icon={Truck} title="Cash on Delivery" body="Pay on receipt" />
                <TrustItem icon={ShieldCheck} title="Genuine product" body="100% authentic" />
                <TrustItem icon={MessageCircle} title="Quick support" body="Reply within an hour" />
              </div>
            </div>
          </section>

          {/* Description — the Basic Info description, shown on the funnel
              layout too (previously only the standard layout rendered it). */}
          {product.description && (
            <section className="mx-auto max-w-3xl px-4 sm:px-6 mt-12">
              <h2 className="text-2xl font-bold text-slate-900 text-center mb-5">About this product</h2>
              <p className="text-slate-600 leading-relaxed whitespace-pre-line">{product.description}</p>
            </section>
          )}

          {/* Benefits */}
          {product.funnel?.benefits && product.funnel.benefits.length > 0 && (
            <section className="mx-auto max-w-3xl px-4 sm:px-6 mt-14">
              <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">Why you'll love it</h2>
              <div className="grid sm:grid-cols-2 gap-5">
                {product.funnel.benefits.map((b, i) => (
                  <div key={i} className="rounded-2xl bg-white ring-1 ring-slate-200 p-5 flex items-start gap-3">
                    <div className="w-9 h-9 shrink-0 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold">
                      {i + 1}
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed pt-1.5">
                      {typeof b === 'string' ? b : ((b as any)?.title ?? (b as any)?.body ?? '')}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Reviews — social proof */}
          {(product.reviews?.items?.length ?? 0) > 0 && (
            <section className="mx-auto max-w-3xl px-4 sm:px-6 mt-14">
              <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">What customers say</h2>
              <div className="grid sm:grid-cols-2 gap-5">
                {product.reviews.items.slice(0, 6).map((r) => (
                  <article key={r.id} className="rounded-2xl bg-white ring-1 ring-slate-200 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center gap-0.5">
                        {[1,2,3,4,5].map((n) => (
                          <Star key={n} className={`h-3.5 w-3.5 ${n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                        ))}
                      </div>
                      <span className="text-sm font-medium text-slate-900">{r.author}</span>
                    </div>
                    {r.title && <p className="text-sm font-semibold text-slate-900 mb-1">{r.title}</p>}
                    <p className="text-sm text-slate-600 leading-relaxed">{r.body}</p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* FAQ */}
          {product.funnel?.faq && product.funnel.faq.length > 0 && (
            <section className="mx-auto max-w-3xl px-4 sm:px-6 mt-14">
              <h2 className="text-2xl font-bold text-slate-900 text-center mb-6">Frequently asked questions</h2>
              <Accordion type="single" collapsible className="rounded-2xl bg-white ring-1 ring-slate-200 px-5">
                {product.funnel.faq.map((f, i) => (
                  <AccordionItem key={i} value={`q${i}`} className={i === product.funnel!.faq.length - 1 ? 'border-b-0' : ''}>
                    <AccordionTrigger>{f.q}</AccordionTrigger>
                    <AccordionContent>{f.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          )}

          {/* Final CTA */}
          <section className="mx-auto max-w-3xl px-4 sm:px-6 my-16 text-center">
            <a href="#buy"
               className="inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold px-8 py-4 rounded-xl text-base shadow-lg shadow-brand-600/25 transition-all hover:-translate-y-0.5 active:translate-y-0">
              Order yours now
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/></svg>
            </a>
            <p className="mt-3 text-xs text-slate-500">Cash on delivery available · Takes ~30 seconds to order</p>
          </section>
        </main>
      )}

      <Footer meta={meta} />
      <MessengerCTA href={meta.messenger?.url ?? null} />
    </>
  );
}

function ProductGallery({ product }: { product: ProductDetail }) {
  // The API returns `gallery_urls: string[]` plus the `image_url` thumbnail.
  // Compose them into a stable list (primary first, then any extras).
  const urls = [
    ...(product.image_url ? [product.image_url] : []),
    ...(product.gallery_urls ?? []),
  ].filter((u, i, arr) => u && arr.indexOf(u) === i);

  return (
    <div className="space-y-3">
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-slate-100">
        {urls[0] && (
          <FitImage src={urls[0]} alt={product.name} eager />
        )}
      </div>
      {urls.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {urls.slice(0, 4).map((src, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 ring-1 ring-slate-200">
              <img src={src} alt={product.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FunnelGallery({ product }: { product: ProductDetail }) {
  // Gallery images first (the funnel showcase), then the primary image_url.
  const urls = [
    ...(product.gallery_urls ?? []),
    ...(product.image_url ? [product.image_url] : []),
  ].filter((u, i, arr) => !!u && arr.indexOf(u) === i);
  const [active, setActive] = useState(0);
  if (urls.length === 0) return null;

  return (
    <section className="mx-auto max-w-3xl px-4 sm:px-6 -mt-2">
      <div className="relative aspect-square sm:aspect-[5/4] rounded-3xl overflow-hidden bg-slate-100 shadow-xl ring-1 ring-slate-200/70">
        <FitImage src={urls[active]} alt={product.name} eager />
      </div>
      {urls.length > 1 && (
        <div className="mt-3 flex flex-wrap justify-center gap-2.5">
          {urls.slice(0, 6).map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              className={`relative h-16 w-16 overflow-hidden rounded-xl bg-slate-100 ring-2 transition ${i === active ? 'ring-brand-500' : 'ring-slate-200 hover:ring-slate-300'}`}
            >
              <img src={src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function TrustItem({ icon: Icon, title, body }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-5 w-5 text-brand-600 shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="text-slate-500">{body}</p>
      </div>
    </div>
  );
}
