import { useState } from 'react';
import { Star, Phone, Facebook, MessageCircle, Link2, Check, ShoppingBag } from 'lucide-react';
import { formatBDT, discountPct } from '../lib/format';
import { Header } from '../components/layout/header';
import { Footer } from '../components/layout/footer';
import { MessengerCTA } from '../components/layout/messenger-cta';
import { FitImage } from '../components/ui/fit-image';
import { NotFoundPage } from './not-found';
import type { ProductDetail, StorefrontMeta } from '../lib/types';

/**
 * Product detail page — single catalog-style layout for every product
 * (replaces the old funnel/standard split). Structure mirrors the
 * reference: gallery (vertical thumbs + big image) + buy box on top,
 * a share row, then a tabbed content area beside a "You May Also Like"
 * + "Quick Summary" sidebar.
 *
 * No inline order form / no cart — the buy box's "Order Now" links to the
 * dedicated /checkout page with the chosen variant.
 */
export function ProductDetailPage({
  product,
  meta,
}: {
  product: ProductDetail | null;
  meta: StorefrontMeta | null;
}) {
  if (!product || !meta) return <NotFoundPage />;

  const category = product.categories?.[0] ?? null;

  return (
    <>
      <Header meta={meta} />

      <main className="mx-auto max-w-[1280px] px-4 sm:px-6 pt-5 pb-16">
        {/* Breadcrumb */}
        <nav className="mb-4 text-xs text-slate-500">
          <a href="/" className="hover:text-brand-600">Home</a>
          <span className="mx-2">/</span>
          {category && (
            <>
              <a href={`/categories/${category.slug}`} className="hover:text-brand-600">{category.name}</a>
              <span className="mx-2">/</span>
            </>
          )}
          <span className="text-slate-700">{product.name}</span>
        </nav>

        {/* Top: gallery + buy box */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-10">
          <div className="lg:sticky lg:top-6 lg:self-start">
            <ProductGallery product={product} />
          </div>
          <BuyBox product={product} meta={meta} />
        </div>

        {/* Share */}
        <ShareRow name={product.name} />

        {/* Tabs + sidebar */}
        <div className="mt-8 grid lg:grid-cols-[minmax(0,1fr)_320px] gap-8 items-start">
          <ProductTabs product={product} />
          <Sidebar product={product} meta={meta} category={category} />
        </div>
      </main>

      <Footer meta={meta} />
      <MessengerCTA href={meta.messenger?.url ?? null} />
    </>
  );
}

/* ── Gallery: vertical thumbnails + big image ─────────────────────────── */
function ProductGallery({ product }: { product: ProductDetail }) {
  const urls = [
    ...(product.image_url ? [product.image_url] : []),
    ...(product.gallery_urls ?? []),
  ].filter((u, i, arr) => !!u && arr.indexOf(u) === i);
  const [active, setActive] = useState(0);

  if (urls.length === 0) {
    return <div className="aspect-square rounded-2xl bg-slate-100" />;
  }

  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row">
      {urls.length > 1 && (
        <div className="flex gap-2 overflow-x-auto sm:flex-col sm:overflow-visible">
          {urls.slice(0, 6).map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white ring-2 transition ${i === active ? 'ring-brand-500' : 'ring-slate-200 hover:ring-slate-300'}`}
            >
              <img src={src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain p-1" />
            </button>
          ))}
        </div>
      )}
      <div className="relative aspect-square flex-1 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        <FitImage src={urls[active]} alt={product.name} eager />
      </div>
    </div>
  );
}

/* ── Buy box ──────────────────────────────────────────────────────────── */
function BuyBox({ product, meta }: { product: ProductDetail; meta: StorefrontMeta }) {
  const [variantIdx, setVariantIdx] = useState<number | null>(product.variants[0]?.index ?? null);
  const selected = product.variants.find((v) => v.index === variantIdx) ?? null;
  const unitPrice = selected?.price ?? product.price;
  const inStock = selected ? selected.in_stock : product.in_stock;
  const discount = discountPct(unitPrice, product.compare_at_price);
  const benefits = product.funnel?.benefits ?? [];
  const phone = meta.whatsapp?.trim() || null;

  const checkoutHref = `/checkout?p=${encodeURIComponent(product.slug)}${variantIdx != null ? `&v=${variantIdx}` : ''}`;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">{product.name}</h1>

      {(product.rating_count ?? 0) > 0 && product.rating_avg != null && (
        <div className="flex items-center gap-2 text-sm">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} className={`h-4 w-4 ${n <= Math.round(product.rating_avg!) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
            ))}
          </div>
          <span className="font-semibold text-slate-900">{product.rating_avg.toFixed(1)}</span>
          <span className="text-slate-500">({product.rating_count} reviews)</span>
        </div>
      )}

      {/* Feature list (from Benefit Bullets) */}
      {benefits.length > 0 && (
        <ol className="space-y-2.5">
          {benefits.map((b, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-slate-700">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">{i + 1}</span>
              <span className="leading-relaxed">{typeof b === 'string' ? b : ((b as any)?.title ?? '')}</span>
            </li>
          ))}
        </ol>
      )}

      {/* Contact line */}
      {phone && (
        <p className="border-t border-slate-100 pt-4 text-base font-bold text-slate-900">
          Details :{' '}
          <a href={`tel:${phone.replace(/\s/g, '')}`} className="font-semibold text-brand-600 hover:underline">
            <Phone className="mb-0.5 mr-1 inline h-4 w-4" />{phone}
          </a>
        </p>
      )}

      {/* Price + status */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-slate-500">Price:</span>
        <span className="text-2xl font-bold text-rose-600">{formatBDT(unitPrice, { currency: product.currency })}</span>
        {product.compare_at_price && product.compare_at_price > unitPrice && (
          <span className="text-base text-slate-400 line-through">{formatBDT(product.compare_at_price, { currency: product.currency })}</span>
        )}
        {discount && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600">Save {discount}%</span>}
        <span className="ml-auto text-sm">
          Status: <span className={inStock ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>{inStock ? 'In Stock' : 'Out of Stock'}</span>
        </span>
      </div>

      {/* Variant picker (only if the product has variants) */}
      {product.variants.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Choose option</p>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((v) => (
              <button
                key={v.index}
                type="button"
                disabled={!v.in_stock}
                onClick={() => setVariantIdx(v.index)}
                className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${variantIdx === v.index ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-700 hover:border-slate-400'} ${!v.in_stock ? 'cursor-not-allowed opacity-40' : ''}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Order Now → checkout */}
      {inStock ? (
        <a
          href={checkoutHref}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3.5 text-base font-bold text-white shadow-sm transition hover:bg-slate-800"
        >
          <ShoppingBag className="h-5 w-5" /> Order Now
        </a>
      ) : (
        <span className="flex w-full cursor-not-allowed items-center justify-center rounded-xl bg-slate-200 px-6 py-3.5 text-base font-bold text-slate-500">
          Out of Stock
        </span>
      )}
    </div>
  );
}

/* ── Share row ────────────────────────────────────────────────────────── */
function ShareRow({ name }: { name: string }) {
  const [copied, setCopied] = useState(false);
  const url = () => (typeof window !== 'undefined' ? window.location.href : '');

  const shareFb = () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url())}`, '_blank', 'noopener,width=640,height=640');
  const shareWa = () => window.open(`https://wa.me/?text=${encodeURIComponent(`${name} ${url()}`)}`, '_blank', 'noopener');
  const copy = async () => {
    try { await navigator.clipboard.writeText(url()); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  };

  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-2 border-y border-slate-100 py-4">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Share</span>
      <button type="button" onClick={shareFb} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
        <Facebook className="h-4 w-4 text-blue-600" /> Facebook
      </button>
      <button type="button" onClick={shareWa} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
        <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp
      </button>
      <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Link2 className="h-4 w-4 text-slate-500" />}
        {copied ? 'Copied' : 'Copy Link'}
      </button>
    </div>
  );
}

/* ── Tabs ─────────────────────────────────────────────────────────────── */
function ProductTabs({ product }: { product: ProductDetail }) {
  const galleryUrls = (product.gallery_urls ?? []).filter(Boolean);
  const reviews = product.reviews?.items ?? [];
  const faq = product.funnel?.faq ?? [];

  const tabs = [
    product.description ? { key: 'description', label: 'Description' } : null,
    galleryUrls.length ? { key: 'galleries', label: 'Galleries' } : null,
    reviews.length ? { key: 'reviews', label: 'Reviews' } : null,
    faq.length ? { key: 'faq', label: 'FAQ' } : null,
  ].filter(Boolean) as { key: string; label: string }[];

  const [active, setActive] = useState(tabs[0]?.key ?? 'description');
  if (tabs.length === 0) return <div />;

  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-200">
      <div className="flex flex-wrap gap-1 border-b border-slate-100 p-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${active === t.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-5 sm:p-6">
        {active === 'description' && product.description && (
          <div className="prose prose-sm max-w-none whitespace-pre-line text-slate-600">{product.description}</div>
        )}

        {active === 'galleries' && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {galleryUrls.map((src, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
                <img src={src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain p-2" />
              </div>
            ))}
          </div>
        )}

        {active === 'reviews' && (
          <div className="space-y-4">
            {reviews.slice(0, 10).map((r) => (
              <article key={r.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                <div className="mb-1 flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`h-3.5 w-3.5 ${n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                    ))}
                  </div>
                  <span className="text-sm font-medium text-slate-900">{r.author}</span>
                </div>
                {r.title && <p className="text-sm font-semibold text-slate-900">{r.title}</p>}
                <p className="text-sm leading-relaxed text-slate-600">{r.body}</p>
              </article>
            ))}
          </div>
        )}

        {active === 'faq' && (
          <div className="space-y-4">
            {faq.map((f, i) => (
              <div key={i} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                <p className="text-sm font-semibold text-slate-900">{f.q}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{f.a}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sidebar: You May Also Like + Quick Summary ───────────────────────── */
function Sidebar({
  product,
  meta,
  category,
}: {
  product: ProductDetail;
  meta: StorefrontMeta;
  category: { slug: string; name: string } | null;
}) {
  const related = (product.related_products ?? []).slice(0, 4);

  return (
    <aside className="space-y-6">
      {related.length > 0 && (
        <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-4">
          <h2 className="mb-3 border-b border-slate-100 pb-3 text-sm font-bold text-slate-900">🎁 You May Also Like</h2>
          <div className="space-y-3">
            {related.map((p) => (
              <a key={p.slug} href={`/products/${p.slug}`} className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-slate-50">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
                  {p.image_url && <img src={p.image_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain p-1" />}
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-xs font-semibold text-slate-900">{p.name}</p>
                  <p className="mt-0.5 text-sm font-bold text-brand-600">{formatBDT(p.price, { currency: meta.currency })}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-4">
        <h2 className="mb-3 border-b border-slate-100 pb-3 text-sm font-bold text-slate-900">Quick Summary</h2>
        <dl className="space-y-2.5 text-sm">
          {product.brand && (
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Brand</dt><dd className="text-right font-semibold text-slate-900">{product.brand}</dd></div>
          )}
          {category && (
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Category</dt><dd className="text-right font-semibold text-slate-900">{category.name}</dd></div>
          )}
          <div className="flex justify-between gap-3"><dt className="text-slate-500">Price</dt><dd className="text-right font-bold text-brand-600">{formatBDT(product.price, { currency: product.currency })}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-500">Availability</dt><dd className={`text-right font-semibold ${product.in_stock ? 'text-emerald-600' : 'text-rose-600'}`}>{product.in_stock ? 'In Stock' : 'Out of Stock'}</dd></div>
        </dl>
      </div>
    </aside>
  );
}
